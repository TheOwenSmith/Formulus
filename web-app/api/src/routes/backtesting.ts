import { config } from '@api/lib/config';
import { prisma } from '@api/lib/prisma';
import { sqs } from '@api/lib/sqs';
import { type TRPCContext } from '@api/lib/trpc';
import { createUserAuthenticationProcedure } from '@api/middleware/authentication';
import { createSubmission, getSubmissionStatus } from '@api/repository/db-submission';
import { badRequest, fromThrowableAsync, internal } from '@api/utils/error-handling';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { retrieveBacktestingResultsByPublicId } from '@api/repository/db-backtesting-results';
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
          timespan: z.tuple([z.string().nullable(), z.string().nullable()]).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { user } = ctx;
        const { algorithms: algorithmRefs, timespan } = input;

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

        // Create submission with snapshotted algorithm versions
        const submissionResult = await createSubmission({
          algorithms,
          creatorId: user.id,
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
