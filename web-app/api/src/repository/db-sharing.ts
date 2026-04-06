import { prisma } from '@api/lib/prisma';
import { fromThrowableAsync, internal, type AppError } from '@api/utils/error-handling';
import { err, ok, type Result } from 'neverthrow';

export type ShareEntry = {
  userId: string;
  userName: string;
  userEmail: string;
  userImage: string | null;
  allowCopy: boolean;
  dismissedByRecipient: boolean;
  sharedAt: Date;
};

export type SharedResultEntry = {
  publicId: string;
  name: string | null;
  isPublic: boolean;
  algorithmNames: string[];
  creatorName: string;
  creatorImage: string | null;
  allowCopy: boolean;
  sharedAt: Date;
};

export type ResultAccessInfo = {
  hasAccess: boolean;
  isOwner: boolean;
  canCopy: boolean;
  isPublic: boolean;
};

export async function searchUserByEmail(
  email: string,
  requestingUserId: string,
): Promise<Result<{ id: string; name: string; email: string; image: string | null } | null, AppError>> {
  const result = await fromThrowableAsync(
    () =>
      prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true, email: true, image: true },
      }),
    (e) => internal(e, 'Failed to search user'),
  );
  if (result.isErr()) return err(result.error);
  const user = result.value;
  if (user == null || user.id === requestingUserId) return ok(null);
  return ok(user);
}

export async function getResultRow(
  publicId: string,
): Promise<Result<{ id: string; creatorId: string | null; isPublic: boolean } | null, AppError>> {
  const result = await fromThrowableAsync(
    () =>
      prisma.backtestingResults.findUnique({
        where: { publicId },
        select: { id: true, creatorId: true, isPublic: true },
      }),
    (e) => internal(e, 'Failed to load result'),
  );
  if (result.isErr()) return err(result.error);
  return ok(result.value);
}

export async function upsertShare(
  backtestingResultsId: string,
  recipientUserId: string,
  allowCopy: boolean,
): Promise<Result<undefined, AppError>> {
  const result = await fromThrowableAsync(
    () =>
      prisma.backtestingShare.upsert({
        where: {
          userId_backtestingResultsId: { userId: recipientUserId, backtestingResultsId },
        },
        create: { userId: recipientUserId, backtestingResultsId, allowCopy },
        update: { allowCopy, dismissedByRecipient: false },
      }),
    (e) => internal(e, 'Failed to create share'),
  );
  if (result.isErr()) return err(result.error);
  return ok(undefined);
}

export async function removeShare(
  backtestingResultsId: string,
  recipientUserId: string,
): Promise<Result<boolean, AppError>> {
  const result = await fromThrowableAsync(
    () =>
      prisma.backtestingShare.deleteMany({
        where: { backtestingResultsId, userId: recipientUserId },
      }),
    (e) => internal(e, 'Failed to remove share'),
  );
  if (result.isErr()) return err(result.error);
  return ok(result.value.count > 0);
}

export async function getSharesForResult(
  publicId: string,
  creatorId: string,
): Promise<Result<ShareEntry[], AppError>> {
  const result = await fromThrowableAsync(
    () =>
      prisma.backtestingShare.findMany({
        where: { backtestingResults: { publicId, creatorId } },
        orderBy: { createdAt: 'asc' },
        select: {
          allowCopy: true,
          createdAt: true,
          dismissedByRecipient: true,
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      }),
    (e) => internal(e, 'Failed to load shares'),
  );
  if (result.isErr()) return err(result.error);
  return ok(
    result.value.map((s) => ({
      userId: s.user.id,
      userName: s.user.name,
      userEmail: s.user.email,
      userImage: s.user.image,
      allowCopy: s.allowCopy,
      dismissedByRecipient: s.dismissedByRecipient,
      sharedAt: s.createdAt,
    })),
  );
}

export async function getSharedWithMe(userId: string): Promise<Result<SharedResultEntry[], AppError>> {
  const result = await fromThrowableAsync(
    () =>
      prisma.backtestingShare.findMany({
        where: { userId, dismissedByRecipient: false },
        orderBy: { createdAt: 'desc' },
        select: {
          allowCopy: true,
          createdAt: true,
          backtestingResults: {
            select: {
              publicId: true,
              isPublic: true,
              algorithms: { select: { name: true }, orderBy: { name: 'asc' } },
              submissions: {
                take: 1,
                orderBy: { createdAt: 'desc' },
                select: { name: true },
              },
              creator: { select: { name: true, image: true } },
            },
          },
        },
      }),
    (e) => internal(e, 'Failed to load shared results'),
  );
  if (result.isErr()) return err(result.error);
  return ok(
    result.value.map((s) => ({
      publicId: s.backtestingResults.publicId,
      name: s.backtestingResults.submissions[0]?.name ?? null,
      isPublic: s.backtestingResults.isPublic,
      algorithmNames: s.backtestingResults.algorithms.map((a) => a.name),
      creatorName: s.backtestingResults.creator?.name ?? 'Deleted User',
      creatorImage: s.backtestingResults.creator?.image ?? null,
      allowCopy: s.allowCopy,
      sharedAt: s.createdAt,
    })),
  );
}

export async function dismissShare(
  userId: string,
  publicId: string,
): Promise<Result<boolean, AppError>> {
  const result = await fromThrowableAsync(
    () =>
      prisma.backtestingShare.updateMany({
        where: { userId, backtestingResults: { publicId } },
        data: { dismissedByRecipient: true },
      }),
    (e) => internal(e, 'Failed to dismiss share'),
  );
  if (result.isErr()) return err(result.error);
  return ok(result.value.count > 0);
}

export async function setResultPublic(
  publicId: string,
  creatorId: string,
  isPublic: boolean,
): Promise<Result<boolean, AppError>> {
  const result = await fromThrowableAsync(
    () =>
      prisma.backtestingResults.updateMany({
        where: { publicId, creatorId },
        data: { isPublic },
      }),
    (e) => internal(e, 'Failed to update result visibility'),
  );
  if (result.isErr()) return err(result.error);
  return ok(result.value.count > 0);
}

export async function getResultAccessInfo(
  publicId: string,
  userId: string,
): Promise<Result<ResultAccessInfo | null, AppError>> {
  const result = await fromThrowableAsync(
    () =>
      prisma.backtestingResults.findUnique({
        where: { publicId },
        select: {
          creatorId: true,
          isPublic: true,
          shares: {
            where: { userId },
            select: { allowCopy: true },
          },
        },
      }),
    (e) => internal(e, 'Failed to check result access'),
  );
  if (result.isErr()) return err(result.error);
  if (result.value == null) return ok(null);

  const { creatorId, isPublic, shares } = result.value;
  const isOwner = creatorId === userId;
  const shareEntry = shares[0];
  const hasAccess = isOwner || isPublic || shareEntry != null;
  const canCopy = isOwner || (shareEntry?.allowCopy ?? false);

  return ok({ hasAccess, isOwner, canCopy, isPublic });
}
