import { DeleteMessageCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { convertAlgorithmVersionToUserAlgorithm } from '@shared/db/algorithm-version';
import { BacktestingSubmissionStatus } from '@shared/generated/prisma/enums';
import { backtestAlgorithmsConcurrently } from '@worker/core/backtesting/backtest-algorithms-concurrently';
import { interactiveBrokersSlippageFunction } from '@worker/core/backtesting/slippage-functions';
import {
  fromThrowable,
  fromThrowableAsync,
  internal,
  type AppError,
} from '@worker/utils/error-handling';
import { err, ok, type Result } from 'neverthrow';
import z from 'zod';
import { config } from './lib/config';
import { sqs } from './lib/sqs';
import { createBacktestingResults } from './repository/db-backtesting-results';
import {
  getSubmissionCurrentStatus,
  getSubmissionWithVersions,
  updateSubmissionStatus,
} from './repository/db-submission';

// Thrown from onProgress to abort the backtest loop when a cancellation is detected.
// Caught immediately in processSubmission — never escapes to the SQS loop.
class BacktestCancelled {
  readonly _tag = 'BacktestCancelled' as const;
}

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
    return err(
      internal(new Error(`Submission not found: ${submissionId}`), 'Submission not found'),
    );
  }

  if (submission.status === BacktestingSubmissionStatus.CANCELLED) {
    console.log(`Submission ${submissionId} was cancelled`);
    return ok(undefined);
  }

  // Mark as running — "Preparing" phase (Docker setup + compilation)
  const markRunningResult = await updateSubmissionStatus(
    submissionId,
    BacktestingSubmissionStatus.RUNNING,
    { message: 'Preparing...' },
  );
  if (markRunningResult.isErr()) return err(markRunningResult.error);

  // Convert DB algorithm versions to the worker algorithm types
  const algorithms = submission.algorithmVersions.map(convertAlgorithmVersionToUserAlgorithm);
  // algorithmId may be null if the source algorithm was deleted after submission;
  // filter to only IDs that still exist so the results can still be stored.
  const algorithmIds = submission.algorithmVersions
    .map((v) => v.algorithmId)
    .filter((id): id is string => id != null);

  // Track first progress tick to transition message from "Preparing..." to "Running..."
  let isFirstProgress = true;

  // Run the backtest
  // TODO: populate tickerData with paths to market data files (e.g. from S3 or a local DATA_DIR)
  let backtestResult: Awaited<ReturnType<typeof backtestAlgorithmsConcurrently>>;
  try {
    backtestResult = await backtestAlgorithmsConcurrently({
      algorithms,
      options: {
        onProgress: async (pct) => {
          // Check if the submission was cancelled externally before writing progress.
          const statusResult = await getSubmissionCurrentStatus(submissionId);
          if (statusResult.isOk() && statusResult.value === BacktestingSubmissionStatus.CANCELLED) {
            throw new BacktestCancelled();
          }

          const extra: { progressPct: number; message?: string } = { progressPct: pct };
          if (isFirstProgress) {
            isFirstProgress = false;
            extra.message = 'Running...';
          }
          const r = await updateSubmissionStatus(
            submissionId,
            BacktestingSubmissionStatus.RUNNING,
            extra,
          );
          if (r.isErr()) console.warn(`Failed to write progress for ${submissionId}:`, r.error);
        },
      },
      slippageMapFn: interactiveBrokersSlippageFunction,
      timespan:
        submission.startTimespan != null || submission.endTimespan != null
          ? [submission.startTimespan, submission.endTimespan]
          : undefined,
    });
  } catch (e) {
    if (e instanceof BacktestCancelled) {
      console.log(`Submission ${submissionId} was cancelled mid-backtest`);
      return ok(undefined);
    }
    return err(
      internal(e instanceof Error ? e : new Error(String(e)), 'Backtest threw unexpectedly'),
    );
  }

  // Check for cancellation that happened after the last onProgress tick but before completion.
  // Without this, a backtest that finishes between progress checks would overwrite CANCELLED with FINISHED.
  const postBacktestStatusResult = await getSubmissionCurrentStatus(submissionId);
  if (
    postBacktestStatusResult.isOk() &&
    postBacktestStatusResult.value === BacktestingSubmissionStatus.CANCELLED
  ) {
    console.log(`Submission ${submissionId} was cancelled just before completion`);
    return ok(undefined);
  }

  if (backtestResult.isErr()) {
    const { code, message, error, isUserCode } = backtestResult.error;
    console.error(`Backtest failed for submission ${submissionId}:`, message, error);
    const markErrorResult = await updateSubmissionStatus(
      submissionId,
      BacktestingSubmissionStatus.ERROR,
      {
        error: message ?? 'Unknown error',
        errorCode: isUserCode ? 'USER_CODE' : code,
        errorDetail: serializeErrorDetail(error),
      },
    );
    if (markErrorResult.isErr()) {
      console.error(`Failed to mark submission ${submissionId} as ERROR:`, markErrorResult.error);
    }
    // Backtest failures are terminal (user code errors, timeouts, etc.) — ack the message.
    return ok(undefined);
  }

  // Transition to "Finishing" phase — saving results to DB
  await updateSubmissionStatus(submissionId, BacktestingSubmissionStatus.RUNNING, {
    message: 'Finishing...',
    progressPct: 100,
  });

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
            VisibilityTimeout: 3600,
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
