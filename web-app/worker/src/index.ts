import { DeleteMessageCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { convertAlgorithmVersionToUserAlgorithm } from '@shared/db/algorithm-version';
import { BacktestingSubmissionStatus } from '@shared/generated/prisma/enums';
import { backtestAlgorithmsConcurrently } from '@worker/core/backtesting/backtest-algorithms-concurrently';
import {
  getImageForLanguage,
  type SupportedLanguage,
} from '@worker/core/backtesting/rpc/languages';
import { interactiveBrokersSlippageFunction } from '@worker/core/backtesting/slippage-functions';
import { pullImageIfAbsent } from '@worker/lib/docker';
import {
  fromThrowable,
  fromThrowableAsync,
  internal,
  type AppError,
} from '@worker/utils/error-handling';
import { err, ok, type Result } from 'neverthrow';
import { config } from './lib/config';
import { sqs } from './lib/sqs';
import { createBacktestingResults } from './repository/db-backtesting-results';
import {
  getSubmissionCurrentStatus,
  getSubmissionWithVersions,
  updateSubmissionStatus,
} from './repository/db-submission';

// Thrown from onProgress to abort the backtest loop when a cancellation is detected.
// Caught immediately in processSubmission — never escapes.
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

  const markRunningResult = await updateSubmissionStatus(
    submissionId,
    BacktestingSubmissionStatus.RUNNING,
    { message: 'Preparing...' },
  );
  if (markRunningResult.isErr()) return err(markRunningResult.error);

  const algorithms = submission.algorithmVersions.map(convertAlgorithmVersionToUserAlgorithm);

  const language = algorithms[0]?.language as SupportedLanguage | undefined;
  if (language != null) {
    const pullResult = await pullImageIfAbsent(getImageForLanguage(language));
    if (pullResult.isErr()) return err(pullResult.error);
  }

  const algorithmIds = submission.algorithmVersions
    .map((v) => v.algorithmId)
    .filter((id): id is string => id != null);

  let isFirstProgress = true;

  let backtestResult: Awaited<ReturnType<typeof backtestAlgorithmsConcurrently>>;
  try {
    backtestResult = await backtestAlgorithmsConcurrently({
      algorithms,
      options: {
        onProgress: async (pct) => {
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
        ...(config.env === 'dev' || code !== 'INTERNAL_SERVER_ERROR'
          ? { error: message, errorDetail: serializeErrorDetail(error) }
          : {
              error: "An unexpected error occurred (it's not you, it's us)",
              errorDetail: undefined,
            }),
        errorCode: isUserCode ? 'USER_CODE' : code,
      },
    );
    if (markErrorResult.isErr()) {
      console.error(`Failed to mark submission ${submissionId} as ERROR:`, markErrorResult.error);
    }
    return ok(undefined);
  }

  await updateSubmissionStatus(submissionId, BacktestingSubmissionStatus.RUNNING, {
    message: 'Finishing...',
    progressPct: 100,
  });

  const createResultsResult = await createBacktestingResults({
    algorithmIds,
    creatorId: submission.creatorId,
    name: submission.name,
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

async function devLoop(): Promise<never> {
  const queueUrl = config.getDevKey('QUEUE_URL');
  console.log('Dev mode: polling SQS for submissions...');

  while (true) {
    const receiveResult = await fromThrowableAsync(
      () =>
        sqs.send(
          new ReceiveMessageCommand({
            MaxNumberOfMessages: 1,
            QueueUrl: queueUrl,
            WaitTimeSeconds: 1,
          }),
        ),
      (e) => internal(e, 'Failed to receive SQS message'),
    );
    if (receiveResult.isErr()) {
      console.error('SQS receive error:', receiveResult.error);
      continue;
    }

    for (const message of receiveResult.value.Messages ?? []) {
      const bodyResult = fromThrowable(
        () => JSON.parse(message.Body!) as { submissionId?: string },
        (e) => internal(e, 'Failed to parse SQS message body'),
      );

      if (bodyResult.isErr()) {
        console.error('Malformed SQS message body:', bodyResult.error);
      } else {
        const { submissionId } = bodyResult.value;
        if (submissionId == undefined) {
          console.error('Missing submissionId in SQS message:', message.Body);
        } else {
          console.log(`Processing submission: '${submissionId}'`);
          const result = await processSubmission(submissionId);
          if (result.isErr()) {
            console.error(`Failed to process submission '${submissionId}':`, result.error);
          } else {
            console.log('Submission processed successfully:', submissionId);
          }
        }
      }

      const deleteResult = await fromThrowableAsync(
        () =>
          sqs.send(
            new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle! }),
          ),
        (e) => internal(e, 'Failed to delete SQS message'),
      );
      if (deleteResult.isErr()) {
        console.error('Failed to delete SQS message:', deleteResult.error);
      }
    }
  }
}

async function main() {
  if (config.env === 'dev') {
    await devLoop();
  } else {
    const submissionId = config.getDeployKey('SUBMISSION_ID');
    console.log('Processing submission:', submissionId);
    const result = await processSubmission(submissionId);
    if (result.isErr()) {
      console.error(`Failed to process submission ${submissionId}:`, result.error);
      process.exit(1);
    }
    console.log('Submission processed successfully:', submissionId);
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
