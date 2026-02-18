import { DeleteMessageCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { convertAlgorithmVersionToUserAlgorithm } from '@shared/db/algorithm-version';
import { BacktestingSubmissionStatus } from '@shared/generated/prisma/enums';
import { backtestAlgorithmsConcurrently } from '@worker/core/backtesting/backtest-algorithms-concurrently';
import { interactiveBrokersSlippageFunction } from '@worker/core/backtesting/slippage-functions';
import { fromThrowable, internal } from '@worker/utils/error-handling';
import z from 'zod';
import { config } from './lib/config';
import { sqs } from './lib/sqs';
import { createBacktestingResults } from './repository/db-backtesting-results';
import { getSubmissionWithVersions, updateSubmissionStatus } from './repository/db-submission';

async function processSubmission(submissionId: string): Promise<void> {
  // Load submission and algorithm versions from DB
  const getSubmissionWithVersionsResult = await getSubmissionWithVersions(submissionId);
  if (getSubmissionWithVersionsResult.isErr()) {
    // TODO: handle error
    return;
  }
  const submission = getSubmissionWithVersionsResult.value;
  if (submission == null) {
    // TODO: handle error
    return;
  }

  // Mark as running
  await updateSubmissionStatus(submissionId, BacktestingSubmissionStatus.RUNNING);

  // Convert DB algorithm versions to the worker algorithm types
  const algorithms = submission.algorithmVersions.map(convertAlgorithmVersionToUserAlgorithm);
  const algorithmIds = submission.algorithmVersions.map((v) => v.algorithmId);

  // Run the backtest
  // TODO: populate tickerData with paths to market data files (e.g. from S3 or a local DATA_DIR)
  const backtestResult = await backtestAlgorithmsConcurrently({
    algorithms,
    options: { trackProgress: false },
    slippageMapFn: interactiveBrokersSlippageFunction,
    timespan:
      submission.startTimespan != null || submission.endTimespan != null
        ? [submission.startTimespan, submission.endTimespan]
        : undefined,
  });
  if (backtestResult.isErr()) {
    const message = backtestResult.error.message ?? 'Unknown error';
    console.error(`Backtest failed for submission ${submissionId}:`, message);
    await updateSubmissionStatus(submissionId, BacktestingSubmissionStatus.ERROR, {
      error: message,
    });
    return;
  }

  // Persist results and link to submission
  const resultId = await createBacktestingResults({
    algorithmIds,
    creatorId: submission.creatorId,
    publicId: submission.publicId,
    result: backtestResult.value,
  });

  await updateSubmissionStatus(submissionId, BacktestingSubmissionStatus.FINISHED, { resultId });
  console.log(`Submission ${submissionId} finished — resultId: ${resultId}`);
}

const messageSchema = z.object({
  submissionId: z.string(),
});

async function main() {
  const QueueUrl = config.getKey('QUEUE_URL');
  console.log('Worker listening on:', QueueUrl);

  while (true) {
    const resp = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 5,
        VisibilityTimeout: 60,
      }),
    );

    const msg = resp.Messages?.[0];
    if (msg == undefined) continue;

    const { Body, ReceiptHandle } = msg;
    if (Body == undefined || ReceiptHandle == undefined) {
      console.warn('Bad message:', msg);
      continue;
    }

    const messageParseResponse = fromThrowable(
      () => messageSchema.parse(JSON.parse(Body)),
      (e) => internal('Failed to parse message', e),
    );
    if (messageParseResponse.isErr()) {
      console.error('Failed to parse message:', messageParseResponse.error);
      continue;
    }
    const { submissionId } = messageParseResponse.value;
    console.log('Received submission:', submissionId);

    try {
      await processSubmission(submissionId);
    } catch (e) {
      console.error(`Unhandled error processing submission ${submissionId}:`, e);
      // Don't ack — let the visibility timeout expire so SQS retries
      continue;
    }

    await sqs.send(
      new DeleteMessageCommand({
        QueueUrl,
        ReceiptHandle: msg.ReceiptHandle,
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
