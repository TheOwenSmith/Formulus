import { t } from '@api/lib/trpc';
import z from 'zod';

export const backtestingRouter = t.router({
  'backtest-algorithms': t.procedure
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
        backtestingResultsId: '123',
      };
    }),
  'get-backtesting-results': t.procedure
    .input(
      z.object({
        hash: z.string(),
      }),
    )
    .query(async ({ input }) => {
      return { input };
    }),
});
