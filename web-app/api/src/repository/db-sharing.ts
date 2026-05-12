import { prisma } from '@api/lib/prisma';
import { fromThrowableAsync, internal, type AppError } from '@api/utils/error-handling';
import type { UserModel } from '@shared/generated/prisma/models';
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
  creator: { name: string; image: string | null; isPro: boolean } | null;
};

export async function searchUserByEmail(
  email: string,
  requestingUserId: string,
): Promise<Result<Omit<UserModel, 'emailVerified'> | null, AppError>> {
  const result = await fromThrowableAsync(
    () =>
      prisma.user.findUnique({
        where: { email },
        omit: { emailVerified: true },
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
          user: { select: { email: true, id: true, image: true, name: true } },
        },
      }),
    (e) => internal(e, 'Failed to load shares'),
  );
  if (result.isErr()) return err(result.error);
  return ok(
    result.value.map((s) => ({
      allowCopy: s.allowCopy,
      dismissedByRecipient: s.dismissedByRecipient,
      sharedAt: s.createdAt,
      userEmail: s.user.email,
      userId: s.user.id,
      userImage: s.user.image,
      userName: s.user.name,
    })),
  );
}

export async function getSharedWithMe(
  userId: string,
): Promise<Result<SharedResultEntry[], AppError>> {
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
              algorithms: { orderBy: { name: 'asc' }, select: { name: true } },
              creator: { select: { image: true, name: true } },
              isPublic: true,
              publicId: true,
              submissions: {
                orderBy: { createdAt: 'desc' },
                select: { name: true },
                take: 1,
              },
            },
          },
        },
      }),
    (e) => internal(e, 'Failed to load shared results'),
  );
  if (result.isErr()) return err(result.error);
  return ok(
    result.value.map((s) => ({
      algorithmNames: s.backtestingResults.algorithms.map((a) => a.name),
      allowCopy: s.allowCopy,
      creatorImage: s.backtestingResults.creator?.image ?? null,
      creatorName: s.backtestingResults.creator?.name ?? 'Deleted User',
      isPublic: s.backtestingResults.isPublic,
      name: s.backtestingResults.submissions[0]?.name ?? null,
      publicId: s.backtestingResults.publicId,
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
          creator: { select: { name: true, image: true, stripePlanActive: true } },
        },
      }),
    (e) => internal(e, 'Failed to check result access'),
  );
  if (result.isErr()) return err(result.error);
  if (result.value == null) return ok(null);

  const { creatorId, isPublic, shares, creator } = result.value;
  const isOwner = creatorId === userId;
  const shareEntry = shares[0];

  const hasAccess = isOwner || isPublic || shareEntry != null;
  const canCopy = isOwner ? true : (shareEntry?.allowCopy ?? false);
  const creatorInfo = creator
    ? { name: creator.name, image: creator.image, isPro: creator.stripePlanActive }
    : null;

  return ok({ hasAccess, isOwner, canCopy, isPublic, creator: creatorInfo });
}
