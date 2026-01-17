import { convertTimestampToDbTimestamp } from '@api/core/algorithms/upload-algorithm';
import type { Ticker, Timestamp } from '@api/fetch/types';
import { prisma } from '@api/lib/prisma';
import { nanoid } from 'nanoid';
import type { BacktestAlgorithmsResult } from './backtest-algorithms-concurrently';

export async function uploadBacktestingResults({
  creatorId,
  algorithmsIds,
  result,
}: {
  creatorId: string;
  algorithmsIds: string[];
  result: BacktestAlgorithmsResult;
}): Promise<void> {
  await prisma.backtestingResults.create({
    data: {
      algorithmGraphs: {
        create: result.algorithmGraphs.map((algorithmGraph) => ({
          aggregate: convertTimestampToDbTimestamp(algorithmGraph.aggregate),
          name: algorithmGraph.algorithmPlot.name,
          plotYs: algorithmGraph.algorithmPlot.y,

          descriptionMetrics: {
            create: {
              aggregate: convertTimestampToDbTimestamp(algorithmGraph.descriptionMetrics.aggregate),
              algorithmReturn: algorithmGraph.descriptionMetrics.algorithmReturn,
              averageHoldingDuration: algorithmGraph.descriptionMetrics.averageHoldingDuration,
              contextLength: algorithmGraph.descriptionMetrics.contextLength,
              expectancyPerTrade: algorithmGraph.descriptionMetrics.expectancyPerTrade,
              growthRate: algorithmGraph.descriptionMetrics.growthRate,
              maxHoldingPorportion: algorithmGraph.descriptionMetrics.maxHoldingPorportion,
              positionsClosed: algorithmGraph.descriptionMetrics.positionsClosed,
              profitLossRatio: algorithmGraph.descriptionMetrics.profitLossRatio,
              sharpeRatio: algorithmGraph.descriptionMetrics.sharpeRatio,
              tickers: algorithmGraph.descriptionMetrics.tickers,
              timespanEnd: algorithmGraph.descriptionMetrics.timespan[1],
              timespanStart: algorithmGraph.descriptionMetrics.timespan[0],
              tradesMade: algorithmGraph.descriptionMetrics.tradesMade,
              volatility: algorithmGraph.descriptionMetrics.volatility,
              winRate: algorithmGraph.descriptionMetrics.winRate,
            },
          },
        })),
      },
      algorithms: {
        connect: algorithmsIds.map((id) => ({ id })),
      },
      creatorId,
      publicId: nanoid(12),
      tickerPlots: {
        create: Object.entries(result.tickerPlotByAggregateByTicker)
          .map(([aggregate, tickerPlots]) =>
            Object.entries(tickerPlots).map(([ticker, plot]) => ({
              aggregate: convertTimestampToDbTimestamp(aggregate as Timestamp),
              ticker: ticker as Ticker,
              name: plot.name,
              plotYs: plot.y,
            })),
          )
          .flat(),
      },
      timestampsByAggregate: result.timestampsByAggregate,
    },
  });
}
