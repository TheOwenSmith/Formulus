import type { Ticker } from '@api/fetch/types';
import { prisma } from '@api/lib/prisma';
import { fromThrowableAsync, internal, type AppError } from '@api/utils/error-handling';
import { convertDbTimestampToTimestamp } from '@shared/db/timestamp';
import type { Timestamp } from '@shared/trading-constants';
import type { BacktestAlgorithmsResult, ProfitLossRatio, SimplePlot } from '@shared/worker';
import { err, ok, type Result } from 'neverthrow';

export type BacktestingResultsWithName = BacktestAlgorithmsResult & { name: string | null };

export async function retrieveBacktestingResultsByPublicId(
  publicId: string,
  userId: string,
): Promise<Result<BacktestingResultsWithName | null, AppError>> {
  const getBacktestingResultsResponse = await fromThrowableAsync(
    () =>
      prisma.backtestingResults.findUnique({
        where: {
          publicId,
        },
        include: {
          algorithmGraphs: true,
          tickerPlots: true,
          shares: { where: { userId }, select: { userId: true } },
        },
      }),
    (e) => internal(e),
  );
  if (getBacktestingResultsResponse.isErr()) {
    return err(getBacktestingResultsResponse.error);
  }
  const dbBacktestingResults = getBacktestingResultsResponse.value;
  if (dbBacktestingResults == null) {
    return ok(null);
  }

  // Access control: owner, explicit share recipient, or public result
  const isOwner = dbBacktestingResults.creatorId === userId;
  const hasShare = dbBacktestingResults.shares.length > 0;
  if (!isOwner && !dbBacktestingResults.isPublic && !hasShare) {
    return ok(null);
  }

  const formattedBacktestingResults: BacktestingResultsWithName = {
    name: dbBacktestingResults.name,
    algorithmGraphs: dbBacktestingResults.algorithmGraphs.map((algorithmGraph) => ({
      aggregate: convertDbTimestampToTimestamp(algorithmGraph.aggregate),
      descriptionMetrics: {
        aggregate: convertDbTimestampToTimestamp(algorithmGraph.aggregate),
        algorithmReturn: algorithmGraph.algorithmReturn,
        averageHoldingDuration: algorithmGraph.averageHoldingDuration,
        contextLength: algorithmGraph.contextLength,
        expectancyPerTrade: algorithmGraph.expectancyPerTrade,
        growthRate: algorithmGraph.growthRate,
        maxDrawdown: algorithmGraph.maxDrawdown,
        maxHoldingPorportion: algorithmGraph.maxHoldingPorportion,
        positionsClosed: algorithmGraph.positionsClosed,
        profitLossRatio: algorithmGraph.profitLossRatio as ProfitLossRatio,
        sharpeRatio: algorithmGraph.sharpeRatio,
        tickers: algorithmGraph.tickers,
        timespan: [algorithmGraph.timespanStart, algorithmGraph.timespanEnd],
        tradesMade: algorithmGraph.tradesMade,
        volatility: algorithmGraph.volatility,
        winRate: algorithmGraph.winRate,
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
  return ok(formattedBacktestingResults);
}
