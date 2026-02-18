import { DeleteMessageCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { convertAlgorithmVersionToUserAlgorithm } from '@shared/db/algorithm-version';
import { BacktestingSubmissionStatus } from '@shared/generated/prisma/enums';
import { backtestAlgorithmsConcurrently } from '@worker/core/backtesting/backtest-algorithms-concurrently';
import { interactiveBrokersSlippageFunction } from '@worker/core/backtesting/slippage-functions';
import { fromThrowable, fromThrowableAsync, internal, type AppError } from '@worker/utils/error-handling';
import { err, ok, type Result } from 'neverthrow';
import z from 'zod';
import { config } from './lib/config';
import { sqs } from './lib/sqs';
import { createBacktestingResults } from './repository/db-backtesting-results';
import { getSubmissionWithVersions, updateSubmissionStatus } from './repository/db-submission';

function serializeErrorDetail(error: unknown): string | undefined {
  if (error == null) return undefined;
  if (error instanceof Error) return error.stack ?? error.message;
  if (typeof error === 'string') return error;
  return JSON.stringify(error);
}

async function processSubmission(submissionId: string): Promise<Result<undefined, AppError>> {
  // Load submission and algorithm versions from DB
  const getSubmissionResult = await getSubmissionWithVersions(submissionId);
  if (getSubmissionResult.isErr()) return err(getSubmissionResult.error);

  const submission = getSubmissionResult.value;
  if (submission == null) {
    return err(internal(new Error(`Submission not found: ${submissionId}`), 'Submission not found'));
  }

  // Mark as running
  const markRunningResult = await updateSubmissionStatus(submissionId, BacktestingSubmissionStatus.RUNNING);
  if (markRunningResult.isErr()) return err(markRunningResult.error);

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
    const { code, message, error } = backtestResult.error;
    console.error(`Backtest failed for submission ${submissionId}:`, message, error);
    const markErrorResult = await updateSubmissionStatus(submissionId, BacktestingSubmissionStatus.ERROR, {
      error: message ?? 'Unknown error',
      errorCode: code,
      errorDetail: serializeErrorDetail(error),
    });
    if (markErrorResult.isErr()) {
      console.error(`Failed to mark submission ${submissionId} as ERROR:`, markErrorResult.error);
    }
    // Backtest failures are terminal (user code errors, timeouts, etc.) — ack the message.
    return ok(undefined);
  }

  // Persist results and link to submission
  const createResultsResult = await createBacktestingResults({
    algorithmIds,
    creatorId: submission.creatorId,
    publicId: submission.publicId,
    result: backtestResult.value,
  });
  if (createResultsResult.isErr()) return err(createResultsResult.error);

  const markFinishedResult = await updateSubmissionStatus(
    submissionId,
    BacktestingSubmissionStatus.FINISHED,
    { resultId: createResultsResult.value },
  );
  if (markFinishedResult.isErr()) return err(markFinishedResult.error);

  console.log(`Submission ${submissionId} finished — resultId: ${createResultsResult.value}`);
  return ok(undefined);
}

const messageSchema = z.object({
  submissionId: z.string(),
});

async function main() {
  const QueueUrl = config.getKey('QUEUE_URL');
  console.log('Worker listening on:', QueueUrl);

  while (true) {
    const receiveResult = await fromThrowableAsync(
      () =>
        sqs.send(
          new ReceiveMessageCommand({
            QueueUrl,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 5,
            VisibilityTimeout: 60,
          }),
        ),
      (e) => internal(e, 'Failed to receive SQS message'),
    );
    if (receiveResult.isErr()) {
      console.error('Failed to receive SQS message:', receiveResult.error);
      continue;
    }

    const msg = receiveResult.value.Messages?.[0];
    if (msg == undefined) continue;

    const { Body, ReceiptHandle } = msg;
    if (Body == undefined || ReceiptHandle == undefined) {
      console.warn('Bad message:', msg);
      continue;
    }

    const messageParseResult = fromThrowable(
      () => messageSchema.parse(JSON.parse(Body)),
      (e) => internal(e, 'Failed to parse message'),
    );
    if (messageParseResult.isErr()) {
      console.error('Failed to parse message:', messageParseResult.error);
      continue;
    }
    const { submissionId } = messageParseResult.value;
    console.log('Received submission:', submissionId);

    const processResult = await processSubmission(submissionId);
    if (processResult.isErr()) {
      console.error(`Error processing submission ${submissionId}:`, processResult.error);
      // Don't ack — let the visibility timeout expire so SQS retries.
      continue;
    }

    const deleteResult = await fromThrowableAsync(
      () => sqs.send(new DeleteMessageCommand({ QueueUrl, ReceiptHandle })),
      (e) => internal(e, 'Failed to delete SQS message'),
    );
    if (deleteResult.isErr()) {
      console.error('Failed to delete SQS message:', deleteResult.error);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
