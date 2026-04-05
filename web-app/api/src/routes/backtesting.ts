import { config } from '@api/lib/config';
import { prisma } from '@api/lib/prisma';
import { sqs } from '@api/lib/sqs';
import { type TRPCContext } from '@api/lib/trpc';
import { createUserAuthenticationProcedure } from '@api/middleware/authentication';
import { retrieveBacktestingResultsByPublicId } from '@api/repository/db-backtesting-results';
import {
  cancelSubmission,
  clearSubmissionError,
  createSubmission,
  deleteSubmission,
  getSubmissionNameByResultPublicId,
  getSubmissionsByCreatorId,
  getSubmissionStatus,
} from '@api/repository/db-submission';
import { badRequest, fromThrowableAsync, internal } from '@api/utils/error-handling';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import z from 'zod';

export function backtestingRouter(
  router: TRPCContext['router'],
  authProcedure: ReturnType<typeof createUserAuthenticationProcedure>,
) {
  return router({
    backtestAlgorithms: authProcedure
      .input(
        z.object({
          algorithms: z.object({ id: z.string() }).array().min(1),
          name: z.string().max(64).optional(),
          timespan: z.tuple([z.string().nullable(), z.string().nullable()]).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { user } = ctx;
        const { algorithms: algorithmRefs, name, timespan } = input;

        const algorithmIds = algorithmRefs.map((a) => a.id);

        // Load algorithms and verify ownership
        const algorithmsResult = await fromThrowableAsync(
          () =>
            prisma.algorithm.findMany({
              where: { id: { in: algorithmIds }, creatorId: user.id },
            }),
          (e) => internal(e, 'Failed to load algorithms'),
        );
        if (algorithmsResult.isErr()) {
          throw algorithmsResult.error;
        }
        const algorithms = algorithmsResult.value;

        if (algorithms.length !== algorithmIds.length) {
          throw badRequest('One or more algorithms not found');
        }

        // Throttle: one submission per 20 seconds (global, across all algorithms)
        const throttleWindowMs = 10_000;
        const recentSubmissionResult = await fromThrowableAsync(
          () =>
            prisma.backtestingSubmission.findFirst({
              where: {
                creatorId: user.id,
                createdAt: { gte: new Date(Date.now() - throttleWindowMs) },
              },
              select: { createdAt: true },
              orderBy: { createdAt: 'desc' },
            }),
          (e) => internal(e, 'Failed to check submission throttle'),
        );
        if (recentSubmissionResult.isErr()) throw recentSubmissionResult.error;
        if (recentSubmissionResult.value != null) {
          const secondsLeft = Math.ceil(
            (recentSubmissionResult.value.createdAt.getTime() + throttleWindowMs - Date.now()) / 1000,
          );
          throw badRequest(`Please wait ${secondsLeft}s before submitting another backtest`);
        }

        // Create submission with snapshotted algorithm versions
        const submissionResult = await createSubmission({
          algorithms,
          creatorId: user.id,
          name,
          timespan,
        });
        if (submissionResult.isErr()) {
          throw submissionResult.error;
        }
        const submission = submissionResult.value;

        // Enqueue backtest job
        await sqs.send(
          new SendMessageCommand({
            QueueUrl: config.getKey('QUEUE_URL'),
            MessageBody: JSON.stringify({ submissionId: submission.id }),
          }),
        );

        return { publicId: submission.publicId };
      }),

    getSubmissions: authProcedure.query(async ({ ctx }) => {
      const result = await getSubmissionsByCreatorId(ctx.user.id);
      if (result.isErr()) throw result.error;
      return result.value;
    }),

    getSubmissionStatus: authProcedure
      .input(z.object({ publicId: z.string() }))
      .query(async ({ input }) => {
        const statusResult = await getSubmissionStatus(input.publicId);
        if (statusResult.isErr()) {
          throw statusResult.error;
        }
        if (statusResult.value == null) {
          throw badRequest('Submission not found');
        }
        return statusResult.value;
      }),

    cancelSubmission: authProcedure
      .input(z.object({ publicId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const result = await cancelSubmission(input.publicId, ctx.user.id);
        if (result.isErr()) throw result.error;
        if (!result.value) throw badRequest('Submission not found or already started');
        return { cancelled: true };
      }),

    deleteBacktestResult: authProcedure
      .input(z.object({ publicId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const result = await deleteSubmission(input.publicId, ctx.user.id);
        if (result.isErr()) throw result.error;
        if (!result.value) throw badRequest('Submission not found or not deletable');
        return { deleted: true };
      }),

    clearBacktestError: authProcedure
      .input(z.object({ publicId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const result = await clearSubmissionError(input.publicId, ctx.user.id);
        if (result.isErr()) throw result.error;
        if (!result.value) throw badRequest('Submission not found or not clearable');
        return { cleared: true };
      }),

    getSubmissionName: authProcedure
      .input(z.object({ publicId: z.string() }))
      .query(async ({ input }) => {
        const result = await getSubmissionNameByResultPublicId(input.publicId);
        if (result.isErr()) throw result.error;
        return { name: result.value };
      }),

    getBacktestingResults: authProcedure
      .input(
        z.object({
          publicId: z.string(),
        }),
      )
      .query(async ({ input }) => {
        const retrievedBacktestingResultsResponse = await retrieveBacktestingResultsByPublicId(
          input.publicId,
        );
        if (retrievedBacktestingResultsResponse.isErr()) {
          throw retrievedBacktestingResultsResponse.error;
        }
        return retrievedBacktestingResultsResponse.value;
      }),
  });
}
