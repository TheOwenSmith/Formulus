import { retrieveBacktestingResultsByPublicId } from '@api/core/backtesting/db-backtesting-results';
import { type TRPCContext } from '@api/lib/trpc';
import { createUserAuthenticationProcedure } from '@api/middleware/authentication';
import { tryAsync } from '@api/utils/error-handling';
import { TRPCError } from '@trpc/server';
import { nanoid } from 'nanoid';
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
      .mutation(async ({ input }) => {
        // const { algorithms, timespan } = input;
        // const backtestingResults = await backtestAlgorithmsConcurrently({
        //   algorithms,
        //   timespan,
        //   slippageMapFn: interactiveBrokersSlippageFunction,
        // });
        // return backtestingResults;
        return {
          backtestingResultsId: nanoid(12),
        };
      }),
    getBacktestingResults: authProcedure
      .input(
        z.object({
          publicId: z.string(),
        }),
      )
      .query(async ({ input, ctx }) => {
        const retrievedBacktestingResultsResponse = await tryAsync(() =>
          retrieveBacktestingResultsByPublicId(input.publicId),
        );
        if (!retrievedBacktestingResultsResponse.ok) {
          console.error(`[${ctx.req.path}]`, retrievedBacktestingResultsResponse.error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred while retrieving the backtesting results',
          });
        }
        const backtestingResults = retrievedBacktestingResultsResponse.data;
        return backtestingResults;
      }),
  });
}
