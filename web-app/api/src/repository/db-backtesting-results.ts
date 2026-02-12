import type { Ticker, Timestamp } from '@api/fetch/types';
import type { BacktestingResultsModel } from '@api/generated/prisma/models';
import { prisma } from '@api/lib/prisma';
import {
  convertDbTimestampToTimestamp,
  convertTimestampToDbTimestamp,
} from '@api/repository/db-algorithm';
import { fromThrowableAsync, internal, type AppError } from '@api/utils/error-handling';
import type { BacktestAlgorithmsResult, ProfitLossRatio, SimplePlot } from '@shared/worker';
import { nanoid } from 'nanoid';
import { err, ok, type Result } from 'neverthrow';

export async function uploadBacktestingResults({
  creatorId,
  algorithmsIds,
  result,
}: {
  creatorId: string;
  algorithmsIds: string[];
  result: BacktestAlgorithmsResult;
}): Promise<Result<BacktestingResultsModel, AppError>> {
  const createBacktestingResultsResponse = await fromThrowableAsync(
    () =>
      prisma.backtestingResults.create({
        data: {
          algorithmGraphs: {
            create: result.algorithmGraphs.map((algorithmGraph) => ({
              aggregate: convertTimestampToDbTimestamp(algorithmGraph.aggregate),
              algorithmReturn: algorithmGraph.descriptionMetrics.algorithmReturn,
              averageHoldingDuration: algorithmGraph.descriptionMetrics.averageHoldingDuration,
              contextLength: algorithmGraph.descriptionMetrics.contextLength,
              expectancyPerTrade: algorithmGraph.descriptionMetrics.expectancyPerTrade,
              growthRate: algorithmGraph.descriptionMetrics.growthRate,
              maxHoldingPorportion: algorithmGraph.descriptionMetrics.maxHoldingPorportion,
              name: algorithmGraph.algorithmPlot.name,
              plotYs: algorithmGraph.algorithmPlot.y,
              positionsClosed: algorithmGraph.descriptionMetrics.positionsClosed,
              profitLossRatio: algorithmGraph.descriptionMetrics.profitLossRatio,
              sharpeRatio: algorithmGraph.descriptionMetrics.sharpeRatio,
              tickers: algorithmGraph.descriptionMetrics.tickers,
              timespanEnd: algorithmGraph.descriptionMetrics.timespan[1],
              timespanStart: algorithmGraph.descriptionMetrics.timespan[0],
              tradesMade: algorithmGraph.descriptionMetrics.tradesMade,
              volatility: algorithmGraph.descriptionMetrics.volatility,
              winRate: algorithmGraph.descriptionMetrics.winRate,
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
      }),
    (e) => internal(e),
  );
  if (createBacktestingResultsResponse.isErr()) {
    return err(createBacktestingResultsResponse.error);
  }
  return ok(createBacktestingResultsResponse.value);
}

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
