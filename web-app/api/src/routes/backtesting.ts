import { convertDbTimestampToTimestamp } from '@api/core/algorithms/upload-algorithm';
import type {
  BacktestAlgorithmsResult,
  SimplePlot,
} from '@api/core/backtesting/backtest-algorithms-concurrently';
import type { ProfitLossRatio } from '@api/core/backtesting/statistics';
import type { Ticker, Timestamp } from '@api/fetch/types';
import { prisma } from '@api/lib/prisma';
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
        const { publicId } = input;
        const getBacktestingResultsResponse = await tryAsync(() =>
          prisma.backtestingResults.findUnique({
            where: {
              publicId,
            },
            include: {
              algorithmGraphs: {
                include: {
                  descriptionMetrics: true,
                },
              },
              tickerPlots: true,
            },
          }),
        );
        if (!getBacktestingResultsResponse.ok) {
          console.error(`[${ctx.req.path}]`, getBacktestingResultsResponse.error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred while retrieving the backtesting results',
          });
        }
        const dbBacktestingResults = getBacktestingResultsResponse.data;
        if (dbBacktestingResults == null) {
          return null;
        }

        const formattedBacktestingResults: BacktestAlgorithmsResult = {
          algorithmGraphs: dbBacktestingResults.algorithmGraphs.map((algorithmGraph) => ({
            aggregate: convertDbTimestampToTimestamp(algorithmGraph.aggregate),
            descriptionMetrics: {
              aggregate: convertDbTimestampToTimestamp(algorithmGraph.descriptionMetrics.aggregate),
              algorithmReturn: algorithmGraph.descriptionMetrics.algorithmReturn,
              averageHoldingDuration: algorithmGraph.descriptionMetrics.averageHoldingDuration,
              contextLength: algorithmGraph.descriptionMetrics.contextLength,
              expectancyPerTrade: algorithmGraph.descriptionMetrics.expectancyPerTrade,
              growthRate: algorithmGraph.descriptionMetrics.growthRate,
              maxHoldingPorportion: algorithmGraph.descriptionMetrics.maxHoldingPorportion,
              positionsClosed: algorithmGraph.descriptionMetrics.positionsClosed,
              profitLossRatio: algorithmGraph.descriptionMetrics.profitLossRatio as ProfitLossRatio,
              sharpeRatio: algorithmGraph.descriptionMetrics.sharpeRatio,
              tickers: algorithmGraph.descriptionMetrics.tickers,
              timespan: [
                algorithmGraph.descriptionMetrics.timespanStart,
                algorithmGraph.descriptionMetrics.timespanEnd,
              ],
              tradesMade: algorithmGraph.descriptionMetrics.tradesMade,
              volatility: algorithmGraph.descriptionMetrics.volatility,
              winRate: algorithmGraph.descriptionMetrics.winRate,
            },
            algorithmPlot: {
              name: algorithmGraph.name,
              y: algorithmGraph.plotYs,
            },
          })),
          tickerPlotByAggregateByTicker: dbBacktestingResults.tickerPlots.reduce(
            (acc, tickerPlot) => {
              const aggregate = convertDbTimestampToTimestamp(tickerPlot.aggregate);
              acc[aggregate] ??= {} as Record<Ticker, SimplePlot>;
              acc[aggregate][tickerPlot.ticker] = {
                name: tickerPlot.name,
                y: tickerPlot.plotYs,
              };
              return acc;
            },
            {} as Record<Timestamp, Record<Ticker, SimplePlot>>,
          ),
          timestampsByAggregate: dbBacktestingResults.timestampsByAggregate as Record<
            Timestamp,
            string[]
          >,
        };
        return formattedBacktestingResults;
      }),
  });
}
