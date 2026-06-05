import type { BacktestAlgorithmsResult, Timestamp } from '@shared/constants/trading';
import { convertTimestampToDbTimestamp } from '@shared/db/timestamp';
import { fromThrowableAsync, internal, type AppError } from '@shared/utils/error-handling';
import { prisma } from '@worker/lib/prisma';
import { ok, type Result } from 'neverthrow';

export async function createBacktestingResults({
  algorithmIds,
  creatorId,
  name,
  publicId,
  result,
}: {
  algorithmIds: string[];
  creatorId: string;
  name: string;
  publicId: string;
  result: BacktestAlgorithmsResult;
}): Promise<Result<string, AppError>> {
  return await fromThrowableAsync(
    () =>
      prisma.backtestingResults.create({
        data: {
          algorithmGraphs: {
            create: result.algorithmGraphs.map((ag) => ({
              aggregate: convertTimestampToDbTimestamp(ag.aggregate),
              algorithmReturn: ag.descriptionMetrics.algorithmReturn,
              averageHoldingDuration: ag.descriptionMetrics.averageHoldingDuration,
              contextLength: ag.descriptionMetrics.contextLength,
              expectancyPerTrade: ag.descriptionMetrics.expectancyPerTrade,
              growthRate: ag.descriptionMetrics.growthRate,
              maxDrawdown: ag.descriptionMetrics.maxDrawdown,
              maxHoldingPorportion: ag.descriptionMetrics.maxHoldingPorportion,
              name: ag.algorithmPlot.name,
              plotYs: ag.algorithmPlot.y,
              positionsClosed: ag.descriptionMetrics.positionsClosed,
              profitLossRatio: ag.descriptionMetrics.profitLossRatio,
              sharpeRatio: ag.descriptionMetrics.sharpeRatio,
              tickers: ag.descriptionMetrics.tickers,
              timespanEnd: ag.descriptionMetrics.timespan[1],
              timespanStart: ag.descriptionMetrics.timespan[0],
              tradesMade: ag.descriptionMetrics.tradesMade,
              volatility: ag.descriptionMetrics.volatility,
              winRate: ag.descriptionMetrics.winRate,
            })),
          },
          algorithms: { connect: algorithmIds.map((id) => ({ id })) },
          creatorId,
          name,
          publicId,
          tickerPlots: {
            create: Object.entries(result.tickerPlotByAggregateByTicker).flatMap(
              ([aggregate, plots]) =>
                Object.entries(plots).map(([ticker, plot]) => ({
                  aggregate: convertTimestampToDbTimestamp(aggregate as Timestamp),
                  ticker,
                  name: plot.name,
                  plotYs: plot.y,
                })),
            ),
          },
          timestampsByAggregate: result.timestampsByAggregate,
        },
      }),
    (e) => internal(e, 'Failed to push backtesting results to database'),
  ).andThen((result) => ok(result.id));
}
