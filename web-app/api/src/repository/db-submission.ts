import { BacktestingSubmissionStatus } from '@shared/generated/prisma/enums';
import type { AlgorithmModel, BacktestingSubmissionModel } from '@shared/generated/prisma/models';
import { prisma } from '@api/lib/prisma';
import { fromThrowableAsync, internal, type AppError } from '@api/utils/error-handling';
import { nanoid } from 'nanoid';
import { err, ok, type Result } from 'neverthrow';

export async function createSubmission({
  algorithms,
  creatorId,
  timespan,
}: {
  algorithms: AlgorithmModel[];
  creatorId: string;
  timespan?: [string | null, string | null];
}): Promise<Result<BacktestingSubmissionModel, AppError>> {
  const publicId = nanoid(12);

  const createResult = await fromThrowableAsync(
    () =>
      prisma.backtestingSubmission.create({
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
          publicId,
          startTimespan: timespan?.[0] ?? null,
          status: BacktestingSubmissionStatus.PENDING,
        },
      }),
    (e) => internal(e),
  );

  if (createResult.isErr()) {
    return err(createResult.error);
  }
  return ok(createResult.value);
}

type SubmissionStatus =
  | { status: 'PENDING' | 'RUNNING'; progressPct: number; message: string | null }
  | { status: 'ERROR'; error: string | null; errorCode: string | null; errorDetail: string | null }
  | { status: 'FINISHED'; resultId: string };

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
    default: {
      const _exhaustive: never = submission.status;
      return _exhaustive;
    }
  }
}
