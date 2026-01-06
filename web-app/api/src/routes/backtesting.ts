import { type TRPCContext } from '@api/lib/trpc';
import { createUserAuthenticationProcedure } from '@api/middleware/authentication';
import type { BacktestAlgorithmsResult } from '@api/shared/types';
import fs from 'fs';
import { nanoid } from 'nanoid';
import z from 'zod';

export function backtestingRouter(
  router: TRPCContext['router'],
  authProcedure: ReturnType<typeof createUserAuthenticationProcedure>,
) {
  return router({
    'backtest-algorithms': authProcedure
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
    'get-backtesting-results': authProcedure
      .input(
        z.object({
          publicId: z.string(),
        }),
      )
      .query(async ({ input }) => {
        const { publicId } = input;
        if (publicId !== '12345678') {
          return null;
        }

        const sampleData = JSON.parse(
          fs.readFileSync('./data/mock-data.json', 'utf8'),
        ) as BacktestAlgorithmsResult;
        return sampleData;
      }),
  });
}
