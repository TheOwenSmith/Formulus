import { prisma } from '@api/lib/prisma';
import {
  BASIC_PLAN_MAX_BACKTESTS_PER_MONTH,
  BASIC_PLAN_MAX_CONCURRENT_BACKTESTS,
  LimitReachedError,
  PRO_PLAN_MAX_BACKTESTS_PER_MONTH,
  PRO_PLAN_MAX_CONCURRENT_BACKTESTS,
} from '@shared/constants/limits';
import { BacktestingSubmissionStatus } from '@shared/generated/prisma/enums';
import type {
  AlgorithmModel,
  AlgorithmVersionModel,
  BacktestingSubmissionModel,
} from '@shared/generated/prisma/models';
import {
  badRequest,
  fromThrowableAsync,
  internal,
  type AppError,
} from '@shared/utils/error-handling';
import { nanoid } from 'nanoid';
import { err, ok, type Result } from 'neverthrow';

export type SubmissionSummary = {
  publicId: string;
  name: string | null;
  status: BacktestingSubmissionStatus;
  progressPct: number;
  message: string | null;
  error: string | null;
  errorCode: string | null;
  errorDetail: string | null;
  createdAt: Date;
  startTimespan: string | null;
  endTimespan: string | null;
  algorithmNames: string[];
  algorithmIds: string[];
};

export async function getSubmissionsByCreatorId(
  creatorId: string,
): Promise<Result<SubmissionSummary[], AppError>> {
  const result = await fromThrowableAsync(
    () =>
      prisma.backtestingSubmission.findMany({
        where: { creatorId },
        orderBy: { createdAt: 'desc' },
        select: {
          algorithmVersions: { select: { name: true, algorithmId: true } },
          createdAt: true,
          endTimespan: true,
          error: true,
          errorCode: true,
          errorDetail: true,
          message: true,
          name: true,
          progressPct: true,
          publicId: true,
          startTimespan: true,
          status: true,
        },
      }),
    (e) => internal(e, 'Failed to load submissions'),
  );
  if (result.isErr()) return err(result.error);
  return ok(
    result.value.map((s) => ({
      algorithmIds: s.algorithmVersions
        .map((v) => v.algorithmId)
        .filter((id): id is string => id != null),
      algorithmNames: s.algorithmVersions.map((v) => v.name),
      createdAt: s.createdAt,
      endTimespan: s.endTimespan,
      error: s.error,
      errorCode: s.errorCode,
      errorDetail: s.errorDetail,
      message: s.message,
      name: s.name,
      progressPct: s.progressPct,
      publicId: s.publicId,
      startTimespan: s.startTimespan,
      status: s.status,
    })),
  );
}

export async function createSubmission({
  algorithms,
  creatorId,
  name,
  timespan,
  userIsPro,
}: {
  algorithms: AlgorithmModel[];
  creatorId: string;
  name: string;
  timespan?: [string | null, string | null];
  userIsPro: boolean;
}): Promise<Result<BacktestingSubmissionModel, AppError>> {
  const publicId = nanoid(12);

  const MAX_CONCURRENT_BACKTESTS = userIsPro
    ? PRO_PLAN_MAX_CONCURRENT_BACKTESTS
    : BASIC_PLAN_MAX_CONCURRENT_BACKTESTS;

  const MAX_BACKTESTS_PER_MONTH = userIsPro
    ? PRO_PLAN_MAX_BACKTESTS_PER_MONTH
    : BASIC_PLAN_MAX_BACKTESTS_PER_MONTH;

  const createResult = await fromThrowableAsync(
    () =>
      prisma.$transaction(async (tx) => {
        // Prevent the user from creating more algorithms during transaction
        await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${creatorId} FOR UPDATE`;

        const inProgressSubmissions = await tx.backtestingSubmission.count({
          where: {
            creatorId,
            status: {
              in: [BacktestingSubmissionStatus.PENDING, BacktestingSubmissionStatus.RUNNING],
            },
          },
        });
        if (inProgressSubmissions >= MAX_CONCURRENT_BACKTESTS) {
          throw new LimitReachedError(
            `${userIsPro ? 'Pro' : 'Basic'} plan concurrent backtest limit of ${MAX_CONCURRENT_BACKTESTS} reached`,
          );
        }

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const backtestsThisMonth = await tx.backtestUsageEvent.count({
          where: {
            creatorId,
            createdAt: { gte: startOfMonth },
          },
        });
        if (backtestsThisMonth >= MAX_BACKTESTS_PER_MONTH) {
          throw new LimitReachedError(
            `${userIsPro ? 'Pro' : 'Basic'} plan backtests per month limit of ${MAX_BACKTESTS_PER_MONTH} reached`,
          );
        }

        await tx.backtestUsageEvent.create({ data: { creatorId } });

        return await tx.backtestingSubmission.create({
          data: {
            algorithmVersions: {
              create: algorithms.map((algorithm) => ({
                aggregate: algorithm.aggregate,
                algorithm: { connect: { id: algorithm.id } },
                algorithmMaxHoldingProportion: algorithm.algorithmMaxHoldingProportion,
                contextLength: algorithm.contextLength,
                indicators: algorithm.indicators,
                k: algorithm.k,
                language: algorithm.language,
                name: algorithm.name,
                tickers: algorithm.tickers,
                type: algorithm.type,
                userAlgorithmImplementationCode: algorithm.userAlgorithmImplementationCode,
              })),
            },
            creatorId,
            endTimespan: timespan?.[1] ?? null,
            name,
            publicId,
            startTimespan: timespan?.[0] ?? null,
            status: BacktestingSubmissionStatus.PENDING,
          },
        });
      }),
    (e) => (e instanceof LimitReachedError ? badRequest(e.message) : internal(e)),
  );

  if (createResult.isErr()) {
    return err(createResult.error);
  }
  return ok(createResult.value);
}

type SubmissionStatus =
  | { status: 'PENDING' | 'RUNNING'; progressPct: number; message: string | null }
  | { status: 'ERROR'; error: string | null; errorCode: string | null; errorDetail: string | null }
  | { status: 'FINISHED'; resultId: string }
  | { status: 'CANCELLED' };

export async function getSubmissionStatus(
  publicId: string,
): Promise<Result<SubmissionStatus | null, AppError>> {
  const getResult = await fromThrowableAsync(
    () =>
      prisma.backtestingSubmission.findUnique({
        where: { publicId },
        select: {
          error: true,
          errorCode: true,
          errorDetail: true,
          message: true,
          progressPct: true,
          resultId: true,
          status: true,
        },
      }),
    (e) => internal(e, 'Failed to get submission status'),
  );

  if (getResult.isErr()) {
    return err(getResult.error);
  }

  const submission = getResult.value;
  if (submission == null) {
    return ok(null);
  }

  switch (submission.status) {
    case BacktestingSubmissionStatus.PENDING:
    case BacktestingSubmissionStatus.RUNNING:
      return ok({
        status: submission.status,
        progressPct: submission.progressPct,
        message: submission.message,
      });
    case BacktestingSubmissionStatus.ERROR:
      return ok({
        status: 'ERROR',
        error: submission.error,
        errorCode: submission.errorCode,
        errorDetail: submission.errorDetail,
      });
    case BacktestingSubmissionStatus.FINISHED:
      return ok({ status: 'FINISHED', resultId: submission.resultId! });
    case BacktestingSubmissionStatus.CANCELLED:
      return ok({ status: 'CANCELLED' });
    default: {
      const _exhaustive: never = submission.status;
      return _exhaustive;
    }
  }
}

export async function cancelSubmission(
  publicId: string,
  creatorId: string,
): Promise<Result<boolean, AppError>> {
  const result = await fromThrowableAsync(
    () =>
      prisma.backtestingSubmission.updateMany({
        where: {
          publicId,
          creatorId,
          status: {
            in: [BacktestingSubmissionStatus.PENDING, BacktestingSubmissionStatus.RUNNING],
          },
        },
        data: { status: BacktestingSubmissionStatus.CANCELLED },
      }),
    (e) => internal(e, 'Failed to cancel submission'),
  );
  if (result.isErr()) return err(result.error);
  return ok(result.value.count > 0);
}

export async function deleteSubmission(
  publicId: string,
  creatorId: string,
): Promise<Result<boolean, AppError>> {
  const findResult = await fromThrowableAsync(
    () =>
      prisma.backtestingSubmission.findFirst({
        where: { publicId, creatorId, status: BacktestingSubmissionStatus.FINISHED },
        select: { id: true, resultId: true },
      }),
    (e) => internal(e, 'Failed to find submission'),
  );
  if (findResult.isErr()) return err(findResult.error);
  const submission = findResult.value;
  if (submission == null) return ok(false);

  if (submission.resultId != null) {
    // Deleting BacktestingResults cascades to submission + algorithm versions + graphs + plots
    const deleteResult = await fromThrowableAsync(
      () => prisma.backtestingResults.delete({ where: { id: submission.resultId! } }),
      (e) => internal(e, 'Failed to delete backtesting results'),
    );
    if (deleteResult.isErr()) return err(deleteResult.error);
  } else {
    const deleteResult = await fromThrowableAsync(
      () => prisma.backtestingSubmission.delete({ where: { id: submission.id } }),
      (e) => internal(e, 'Failed to delete submission'),
    );
    if (deleteResult.isErr()) return err(deleteResult.error);
  }
  return ok(true);
}

export async function getAlgorithmVersionsByResultPublicId(
  resultPublicId: string,
): Promise<Result<AlgorithmVersionModel[], AppError>> {
  const result = await fromThrowableAsync(
    () =>
      prisma.backtestingResults.findUnique({
        where: { publicId: resultPublicId },
        select: {
          submissions: {
            take: 1,
            select: {
              algorithmVersions: true,
            },
          },
        },
      }),
    (e) => internal(e, 'Failed to load algorithm versions'),
  );
  if (result.isErr()) return err(result.error);
  const versions = result.value?.submissions[0]?.algorithmVersions ?? [];
  return ok(versions);
}

export async function clearSubmissionError(
  publicId: string,
  creatorId: string,
): Promise<Result<boolean, AppError>> {
  const result = await fromThrowableAsync(
    () =>
      prisma.backtestingSubmission.deleteMany({
        where: {
          publicId,
          creatorId,
          status: {
            in: [BacktestingSubmissionStatus.ERROR, BacktestingSubmissionStatus.CANCELLED],
          },
        },
      }),
    (e) => internal(e, 'Failed to clear submission'),
  );
  if (result.isErr()) return err(result.error);
  return ok(result.value.count > 0);
}
