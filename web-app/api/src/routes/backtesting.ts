import { config } from '@api/lib/config';
import { generateText } from '@api/lib/llm';
import { prisma } from '@api/lib/prisma';
import { sqs } from '@api/lib/sqs';
import { type TRPCContext } from '@api/lib/trpc';
import { createUserAuthenticationProcedure } from '@api/middleware/authentication';
import { retrieveBacktestingResultsByPublicId } from '@api/repository/db-backtesting-results';
import { getResultAccessInfo } from '@api/repository/db-sharing';
import {
  cancelSubmission,
  clearSubmissionError,
  createSubmission,
  deleteSubmission,
  getAlgorithmVersionsByResultPublicId,
  getSubmissionsByCreatorId,
  getSubmissionStatus,
} from '@api/repository/db-submission';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { MAX_ALGORITHMS_TO_COMPARE } from '@shared/constants/limits';
import { badRequest, fromThrowableAsync, internal } from '@shared/utils/error-handling';
import z from 'zod';

export function backtestingRouter(
  router: TRPCContext['router'],
  authProcedure: ReturnType<typeof createUserAuthenticationProcedure>,
) {
  return router({
    backtestAlgorithms: authProcedure
      .input(
        z.object({
          algorithms: z.object({ id: z.string() }).array().min(1).max(MAX_ALGORITHMS_TO_COMPARE),
          name: z.string().max(64),
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
            (recentSubmissionResult.value.createdAt.getTime() + throttleWindowMs - Date.now()) /
              1000,
          );
          throw badRequest(`Please wait ${secondsLeft}s before submitting another backtest`);
        }

        // Create submission with snapshotted algorithm versions
        const submissionResult = await createSubmission({
          algorithms,
          creatorId: user.id,
          name,
          timespan,
          userIsPro: user.stripePlanActive,
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

    cancelSubmission: authProcedure
      .input(z.object({ publicId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const result = await cancelSubmission(input.publicId, ctx.user.id);
        if (result.isErr()) throw result.error;
        if (!result.value) throw badRequest('Submission not found or already started');
        return { cancelled: true };
      }),

    clearBacktestError: authProcedure
      .input(z.object({ publicId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const result = await clearSubmissionError(input.publicId, ctx.user.id);
        if (result.isErr()) throw result.error;
        if (!result.value) throw badRequest('Submission not found or not clearable');
        return { cleared: true };
      }),

    deleteBacktestResult: authProcedure
      .input(z.object({ publicId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const result = await deleteSubmission(input.publicId, ctx.user.id);
        if (result.isErr()) throw result.error;
        if (!result.value) throw badRequest('Submission not found or not deletable');
        return { deleted: true };
      }),

    generateBacktestName: authProcedure
      .input(
        z.object({
          algorithmNames: z
            .string()
            .min(1)
            .max(64)
            .regex(/^[a-zA-Z0-9\-() ]+$/)
            .array()
            .min(1)
            .max(MAX_ALGORITHMS_TO_COMPARE),
        }),
      )
      .mutation(async ({ input }) => {
        const { algorithmNames } = input;
        const listStr = algorithmNames.map((n) => `"${n}"`).join(', ');
        const prompt =
          `You are naming a backtesting run for a stock trading platform. ` +
          `Algorithm(s) being compared: ${listStr}. ` +
          `\n\nGenerate a short, creative run name (max 60 characters). ` +
          `Instead of listing the algorithms literally, identify a theme or pattern. ` +
          `For example: if the algorithms involve gold and oil, a good name is "Commodities Face-Off". ` +
          `If they involve small cap biotech stocks, a good name is "Biotech Micro Cap Run". ` +
          `\n\nRules:` +
          `\n- Output ONLY the name, nothing else. No quotes, no explanation, no punctuation at the end.` +
          `\n- Max 60 characters.` +
          `\n- Never just list the algorithm names — always find the higher-level theme.`;
        const name = await generateText(prompt);
        // Trim to 64 chars to fit the DB column
        return { name: name.slice(0, 64) };
      }),

    getAlgorithmVersionsForResult: authProcedure
      .input(z.object({ publicId: z.string() }))
      .query(async ({ ctx, input }) => {
        const accessResult = await getResultAccessInfo(input.publicId, ctx.user.id);
        if (accessResult.isErr()) throw accessResult.error;
        if (!accessResult.value?.canCopy) return [];
        const result = await getAlgorithmVersionsByResultPublicId(input.publicId);
        if (result.isErr()) throw result.error;
        return result.value;
      }),

    getBacktestingResults: authProcedure
      .input(
        z.object({
          publicId: z.string(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const retrievedBacktestingResultsResponse = await retrieveBacktestingResultsByPublicId(
          input.publicId,
          ctx.user.id,
        );
        if (retrievedBacktestingResultsResponse.isErr()) {
          throw retrievedBacktestingResultsResponse.error;
        }
        return retrievedBacktestingResultsResponse.value;
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
  });
}
