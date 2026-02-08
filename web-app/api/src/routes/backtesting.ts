import { retrieveBacktestingResultsByPublicId } from '@api/core/backtesting/db-backtesting-results';
import { type TRPCContext } from '@api/lib/trpc';
import { createUserAuthenticationProcedure } from '@api/middleware/authentication';
import { fromThrowableAsync, internal } from '@api/utils/error-handling';
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
      .mutation(async () => {
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
      .query(async ({ input }) => {
        const retrievedBacktestingResultsResponse = await fromThrowableAsync(
          () => retrieveBacktestingResultsByPublicId(input.publicId),
          (e) =>
            internal(e, 'An unexpected error occurred while retrieving the backtesting results'),
        );
        if (retrievedBacktestingResultsResponse.isErr()) {
          throw retrievedBacktestingResultsResponse.error;
        }
        return retrievedBacktestingResultsResponse.value;
      }),
  });
}
