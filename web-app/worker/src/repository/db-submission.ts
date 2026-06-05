import { BacktestingSubmissionStatus } from '@shared/generated/prisma/enums';
import type { AlgorithmVersionModel } from '@shared/generated/prisma/models';
import { fromThrowableAsync, internal, type AppError } from '@shared/utils/error-handling';
import { prisma } from '@worker/lib/prisma';
import { err, ok, Result } from 'neverthrow';

export type SubmissionWithVersions = {
  id: string;
  name: string;
  publicId: string;
  creatorId: string;
  status: BacktestingSubmissionStatus;
  startTimespan: string | null;
  endTimespan: string | null;
  algorithmVersions: AlgorithmVersionModel[];
};

export async function getSubmissionWithVersions(
  id: string,
): Promise<Result<SubmissionWithVersions | null, AppError>> {
  return await fromThrowableAsync(
    () =>
      prisma.backtestingSubmission.findUnique({
        where: { id },
        select: {
          algorithmVersions: true,
          creatorId: true,
          endTimespan: true,
          id: true,
          name: true,
          publicId: true,
          startTimespan: true,
          status: true,
        },
      }),
    (e) => internal(e, 'Failed to get submission from the database'),
  );
}

export async function getSubmissionCurrentStatus(
  id: string,
): Promise<Result<BacktestingSubmissionStatus | null, AppError>> {
  const result = await fromThrowableAsync(
    () =>
      prisma.backtestingSubmission.findUnique({
        where: { id },
        select: { status: true },
      }),
    (e) => internal(e, 'Failed to get submission status'),
  );
  if (result.isErr()) return err(result.error);
  return ok(result.value?.status ?? null);
}

export async function updateSubmissionStatus(
  id: string,
  status: BacktestingSubmissionStatus,
  extra?: {
    progressPct?: number;
    message?: string;
    error?: string;
    errorCode?: string;
    errorDetail?: string;
    resultId?: string;
  },
): Promise<Result<undefined, AppError>> {
  return await fromThrowableAsync(
    () =>
      prisma.backtestingSubmission.update({
        where: { id },
        data: { status, ...extra },
      }),
    (e) => internal(e, 'Failed to update submission status in the database'),
  ).andThen(() => ok(undefined));
}
