import {
  convertDbTimestampToTimestamp,
  convertTimestampToDbTimestamp,
} from '@api/core/algorithms/db-algorithm';
import type { Ticker, Timestamp } from '@api/fetch/types';
import { prisma } from '@api/lib/prisma';
import { tryAsync } from '@api/utils/error-handling';
import { nanoid } from 'nanoid';
import type { BacktestAlgorithmsResult, SimplePlot } from './backtest-algorithms-concurrently';
import type { ProfitLossRatio } from './statistics';

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

export async function retrieveBacktestingResultsByPublicId(
  publicId: string,
): Promise<BacktestAlgorithmsResult | null> {
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
    throw getBacktestingResultsResponse.error;
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
}
