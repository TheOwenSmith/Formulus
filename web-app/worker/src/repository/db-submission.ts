import { BacktestingSubmissionStatus } from '@shared/generated/prisma/enums';
import type { AlgorithmVersionModel } from '@shared/generated/prisma/models';
import { prisma } from '@worker/lib/prisma';
import { fromThrowableAsync, internal, type AppError } from '@worker/utils/error-handling';
import { ok, Result } from 'neverthrow';

export type SubmissionWithVersions = {
  id: string;
  publicId: string;
  creatorId: string;
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
          publicId: true,
          startTimespan: true,
        },
      }),
    (e) => internal(e, 'Failed to get submission from the database'),
  );
}

export async function updateSubmissionStatus(
  id: string,
  status: BacktestingSubmissionStatus,
  extra?: { progressPct?: number; message?: string; error?: string; resultId?: string },
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
