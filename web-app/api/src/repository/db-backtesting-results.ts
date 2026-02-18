import type { Ticker, Timestamp } from '@api/fetch/types';
import { prisma } from '@api/lib/prisma';
import { fromThrowableAsync, internal, type AppError } from '@api/utils/error-handling';
import { convertDbTimestampToTimestamp } from '@shared/db/timestamp';
import type { BacktestAlgorithmsResult, ProfitLossRatio, SimplePlot } from '@shared/worker';
import { err, ok, type Result } from 'neverthrow';

export async function retrieveBacktestingResultsByPublicId(
  publicId: string,
): Promise<Result<BacktestAlgorithmsResult | null, AppError>> {
  const getBacktestingResultsResponse = await fromThrowableAsync(
    () =>
      prisma.backtestingResults.findUnique({
        where: {
          publicId,
        },
        include: {
          algorithmGraphs: true,
          tickerPlots: true,
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

  const formattedBacktestingResults: BacktestAlgorithmsResult = {
    algorithmGraphs: dbBacktestingResults.algorithmGraphs.map((algorithmGraph) => ({
      aggregate: convertDbTimestampToTimestamp(algorithmGraph.aggregate),
      descriptionMetrics: {
        aggregate: convertDbTimestampToTimestamp(algorithmGraph.aggregate),
        algorithmReturn: algorithmGraph.algorithmReturn,
        averageHoldingDuration: algorithmGraph.averageHoldingDuration,
        contextLength: algorithmGraph.contextLength,
        expectancyPerTrade: algorithmGraph.expectancyPerTrade,
        growthRate: algorithmGraph.growthRate,
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
