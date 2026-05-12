import { convertAlgorithmVersionToUserAlgorithm } from '@shared/db/algorithm-version';
import { BacktestingSubmissionStatus } from '@shared/generated/prisma/enums';
import { backtestAlgorithmsConcurrently } from '@worker/core/backtesting/backtest-algorithms-concurrently';
import { interactiveBrokersSlippageFunction } from '@worker/core/backtesting/slippage-functions';
import {
  internal,
  type AppError,
} from '@worker/utils/error-handling';
import { err, ok, type Result } from 'neverthrow';
import { config } from './lib/config';
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
        error: message ?? 'Unknown error',
        errorCode: isUserCode ? 'USER_CODE' : code,
        errorDetail: serializeErrorDetail(error),
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

async function main() {
  const submissionId = config.getKey('SUBMISSION_ID');
  console.log('Processing submission:', submissionId);

  const result = await processSubmission(submissionId);
  if (result.isErr()) {
    console.error(`Failed to process submission ${submissionId}:`, result.error);
    process.exit(1);
  }

  console.log('Submission processed successfully:', submissionId);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
