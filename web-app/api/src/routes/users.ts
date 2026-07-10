import { deleteCachedSession } from '@api/lib/cache-session';
import { config } from '@api/lib/config';
import { prisma } from '@api/lib/prisma';
import { s3 } from '@api/lib/s3';
import type { TRPCContext } from '@api/lib/trpc';
import type { createUserAuthenticationProcedure } from '@api/middleware/authentication';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  type BucketLocationConstraint,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BacktestingSubmissionStatus } from '@shared/generated/prisma/enums';
import { fromThrowableAsync, internal, type AppError } from '@shared/utils/error-handling';
import { nanoid } from 'nanoid';
import z from 'zod';

const CONTENT_TYPE_EXT: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

async function ensureDevBucketExists(bucket: string, region: string): Promise<void> {
  const headResult = await fromThrowableAsync(
    () => s3.send(new HeadBucketCommand({ Bucket: bucket })),
    (e) => internal(e, 'Failed to check if bucket exists'),
  );
  if (headResult.isOk()) return;
  const createResult = await fromThrowableAsync(
    () =>
      s3.send(
        new CreateBucketCommand({
          Bucket: bucket,
          CreateBucketConfiguration: { LocationConstraint: region as BucketLocationConstraint },
        }),
      ),
    (e) => internal(e, 'Failed to create bucket'),
  );
  if (createResult.isErr()) throw createResult.error;
}

function extractS3Key(imageUrl: string, bucket: string): string | null {
  // Prod: https://{bucket}.s3.{region}.amazonaws.com/{key}
  if (imageUrl.includes(`${bucket}.s3.`)) {
    const match = /amazonaws\.com\/(.+)$/.exec(imageUrl);
    return match?.[1] ?? null;
  }
  // Dev: http://localhost:4566/{bucket}/{key}
  const devPrefix = `/${bucket}/`;
  const idx = imageUrl.indexOf(devPrefix);
  return idx !== -1 ? imageUrl.slice(idx + devPrefix.length) : null;
}

async function deleteS3ProfileImage(imageUrl: string): Promise<void> {
  const bucket = config.getKey('PFP_BUCKET_NAME');
  const key = extractS3Key(imageUrl, bucket);
  if (key == null) return;
  const deleteResult = await fromThrowableAsync(
    () => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })),
    (e) => e,
  );
  if (deleteResult.isErr()) {
    console.error('Failed to delete old profile image from S3:', deleteResult.error);
  }
}

export function usersRouter(
  router: TRPCContext['router'],
  authProcedure: ReturnType<typeof createUserAuthenticationProcedure>,
) {
  return router({
    deleteAccount: authProcedure
      .input(z.object({ deleteBacktests: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await deleteCachedSession(ctx.sessionToken);

        const getImageResponse = await fromThrowableAsync(
          () => prisma.user.findUnique({ where: { id: ctx.user.id }, select: { image: true } }),
          (e) => internal(e, 'An unexpected error occurred while retrieving the user'),
        );
        if (getImageResponse.isErr()) throw getImageResponse.error;
        const oldImage = getImageResponse.value?.image;

        if (input.deleteBacktests) {
          const deleteResultsResponse = await fromThrowableAsync(
            () => prisma.backtestingResults.deleteMany({ where: { creatorId: ctx.user.id } }),
            (e) => internal(e, 'An unexpected error occurred while deleting backtesting results'),
          );
          if (deleteResultsResponse.isErr()) throw deleteResultsResponse.error;
        }

        const deleteUserResponse = await fromThrowableAsync(
          () => prisma.user.delete({ where: { id: ctx.user.id } }),
          (e) => internal(e, 'An unexpected error occurred while deleting the user'),
        );
        if (deleteUserResponse.isErr()) throw deleteUserResponse.error;

        if (oldImage != null) await deleteS3ProfileImage(oldImage);
        return { success: true };
      }),
    getCurrentUser: authProcedure.query(async ({ ctx }) => {
      const getUserResponse = await fromThrowableAsync(
        () =>
          prisma.user.findUnique({
            where: { id: ctx.user.id },
          }),
        (e) => internal(e, 'An unexpected error occurred while retrieving the current user'),
      );
      if (getUserResponse.isErr()) {
        throw getUserResponse.error;
      }
      const user = getUserResponse.value;

      if (user == null) {
        throw {
          code: 'BAD_GATEWAY',
          message: 'The current user could does not exist',
        } satisfies AppError;
      }
      return { user };
    }),
    getProfileImageUploadUrl: authProcedure
      .input(
        z.object({
          contentType: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
          // In dev, the client sends file data so the API uploads directly to LocalStack,
          // avoiding the browser-to-LocalStack CORS restriction.
          fileData: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const ext = CONTENT_TYPE_EXT[input.contentType]!;
        const key = `${ctx.user.id}/${nanoid()}.${ext}`;
        const bucket = config.getKey('PFP_BUCKET_NAME');
        const objectUrl =
          config.env === 'dev'
            ? `${config.getDevKey('AWS_ENDPOINT_URL')}/${bucket}/${key}`
            : `https://${bucket}.s3.${config.getKey('AWS_REGION')}.amazonaws.com/${key}`;

        if (config.env === 'dev' && input.fileData != null) {
          const ensureResult = await fromThrowableAsync(
            () => ensureDevBucketExists(bucket, config.getKey('AWS_REGION')),
            (e) => internal(e, 'Failed to initialize upload storage'),
          );
          if (ensureResult.isErr()) throw ensureResult.error;

          const base64 = input.fileData.includes(',')
            ? input.fileData.split(',')[1]!
            : input.fileData;
          const putResult = await fromThrowableAsync(
            () =>
              s3.send(
                new PutObjectCommand({
                  Body: Buffer.from(base64, 'base64'),
                  Bucket: bucket,
                  ContentType: input.contentType,
                  Key: key,
                }),
              ),
            (e) => internal(e, 'Failed to upload profile image'),
          );
          if (putResult.isErr()) throw putResult.error;
          return { objectUrl, uploadUrl: null };
        }

        const getSignedUrlResult = await fromThrowableAsync(
          () =>
            getSignedUrl(
              s3,
              new PutObjectCommand({ Bucket: bucket, ContentType: input.contentType, Key: key }),
              { expiresIn: 60 },
            ),
          (e) => internal(e, 'Failed to generate upload URL'),
        );
        if (getSignedUrlResult.isErr()) throw getSignedUrlResult.error;
        return { objectUrl, uploadUrl: getSignedUrlResult.value };
      }),
    getProfileStats: authProcedure.query(async ({ ctx }) => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const getProfileStatsResponse = await fromThrowableAsync(
        () =>
          prisma.$transaction([
            prisma.algorithm.count({
              where: { creatorId: ctx.user.id },
            }),
            prisma.backtestingResults.count({
              where: { creatorId: ctx.user.id },
            }),
            prisma.backtestingShare.count({
              where: { userId: ctx.user.id },
            }),
            prisma.backtestingShare.count({
              where: { backtestingResults: { creatorId: ctx.user.id } },
            }),
            prisma.backtestingSubmission.count({
              where: {
                creatorId: ctx.user.id,
                status: {
                  in: [BacktestingSubmissionStatus.PENDING, BacktestingSubmissionStatus.RUNNING],
                },
              },
            }),
            prisma.backtestUsageEvent.count({
              where: {
                creatorId: ctx.user.id,
                createdAt: { gte: startOfMonth },
              },
            }),
          ]),
        (e) => internal(e, 'An unexpected error occurred while retrieving profile statistics'),
      );
      if (getProfileStatsResponse.isErr()) {
        throw getProfileStatsResponse.error;
      }
      const [
        numberOfAlgorithms,
        numberOfBacktestingResults,
        numberOfBacktestingShares,
        numberOfBacktestingSharesSent,
        concurrentBacktests,
        backtestsThisMonth,
      ] = getProfileStatsResponse.value;

      return {
        backtestsThisMonth,
        concurrentBacktests,
        numberOfAlgorithms,
        numberOfBacktestingResults,
        numberOfBacktestingShares,
        numberOfBacktestingSharesSent,
      };
    }),
    updateProfile: authProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100).optional(),
          image: z.string().url().optional().nullable(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const updateData: { name?: string; image?: string | null } = {};

        if (input.name !== undefined) {
          updateData.name = input.name;
        }

        if (input.image !== undefined) {
          updateData.image = input.image;

          const getImageResponse = await fromThrowableAsync(
            () => prisma.user.findUnique({ where: { id: ctx.user.id }, select: { image: true } }),
            (e) => internal(e, 'An unexpected error occurred while retrieving the current user'),
          );
          if (getImageResponse.isErr()) throw getImageResponse.error;
          const oldImage = getImageResponse.value?.image;
          if (oldImage != null) await deleteS3ProfileImage(oldImage);
        }

        const updateUserResponse = await fromThrowableAsync(
          () =>
            prisma.user.update({
              where: { id: ctx.user.id },
              data: updateData,
            }),
          (e) => internal(e, 'An unexpected error occurred while updating the user'),
        );
        if (updateUserResponse.isErr()) {
          throw updateUserResponse.error;
        }
        const updatedUser = updateUserResponse.value;
        await deleteCachedSession(ctx.sessionToken);
        return { updatedUser };
      }),
  });
}
