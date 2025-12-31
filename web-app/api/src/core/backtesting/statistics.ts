import {
  DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION,
  type Algorithm,
} from '@api/core/algorithms/algorithm';
import type { Ticker, Timestamp } from '@api/fetch/types';
import type { SimplePlot } from '@api/lib/nodeplotlib';
import {
  MAX_POINTS_PER_PLOT,
  type AlgorithmData,
  type WithPerformance,
} from './backtest-algorithms-concurrently';

export function updateGraph<T>({
  graphByIndex,
  graphIndex,
  pointY,
}: {
  graphByIndex: T;
  // keys of T that have number[] values
  graphIndex: { [K in keyof T]: T[K] extends number[] ? K : never }[keyof T];
  pointY: number;
}): boolean {
  const graphYs = graphByIndex[graphIndex] as number[];
  graphYs.push(pointY);

  if (graphYs.length > MAX_POINTS_PER_PLOT) {
    // Reduce the number of points in the plot by half
    const reducedAlgorithmPlot: number[] = [];
    for (let j = 0; j < graphYs.length; j += 2) {
      reducedAlgorithmPlot.push(graphYs[j]);
    }
    (graphByIndex[graphIndex] as number[]) = reducedAlgorithmPlot;
    return true;
  }
  return false;
}

export type ProfitLossRatio =
  | { type: 'VALUE'; value: number }
  | { type: 'NO_LOSSES' }
  | { type: 'UNKNOWN' };

export type DescriptionMetrics = {
  aggregate: Timestamp;
  algorithmReturn: number;
  averageHoldingDuration: number | null;
  contextLength: number;
  expectancyPerTrade: number | null;
  growthRate: number;
  maxHoldingPorportion: number;
  positionsClosed: number;
  profitLossRatio: ProfitLossRatio;
  sharpeRatio: number | null;
  tickers: Ticker[];
  timespan: [string, string];
  tradesMade: number;
  volatility: number | null;
  winRate: number | null;
};

export async function getAlgorithmGraphWithPerformance({
  aggregate,
  algorithm,
  algorithmData,
  performanceFn = (descriptionMetrics: DescriptionMetrics) => descriptionMetrics.growthRate,
  timespan,
  xs,
  yearsBetweenStartAndEnd,
}: {
  aggregate: Timestamp;
  algorithm: Algorithm;
  algorithmData: AlgorithmData;
  performanceFn?: (descriptionMetrics: DescriptionMetrics) => number | Promise<number>;
  timespan: [string, string];
  xs: number[];
  yearsBetweenStartAndEnd: number;
}): Promise<
  WithPerformance<{
    name: string;
    aggregate: Timestamp;
    descriptionMetrics: DescriptionMetrics;
    algorithmPlot: SimplePlot;
  }>
> {
  const {
    contextLength,
    name,
    tickers,
    algorithmMaxHoldingProportion = DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION,
  } = algorithm;
  const {
    balance,
    trades,
    winsLosses,
    cumulativeProfitLoss,
    positionsClosed,
    sharpeRatioCalculator,
    cumulativeHoldingTime,
    algorithmYs,
  } = algorithmData;

  const algorithmPlot: SimplePlot = {
    name: 'Algorithm',
    x: xs,
    y: algorithmYs,
    type: 'scatter',
  };

  const algorithmReturnPercentage = balance - 100;
  const growthRate = Math.pow(balance / 100, 1 / yearsBetweenStartAndEnd) - 1;
  let profitLossRatio: ProfitLossRatio;
  if (cumulativeProfitLoss[1] !== 0) {
    profitLossRatio = { type: 'VALUE', value: cumulativeProfitLoss[0] / cumulativeProfitLoss[1] };
  } else if (cumulativeProfitLoss[0] !== 0) {
    profitLossRatio = { type: 'NO_LOSSES' };
  } else {
    profitLossRatio = { type: 'UNKNOWN' };
  }

  const descriptionMetrics: DescriptionMetrics = {
    aggregate,
    algorithmReturn: algorithmReturnPercentage / 100,
    averageHoldingDuration: positionsClosed > 0 ? cumulativeHoldingTime / positionsClosed : null,
    contextLength,
    expectancyPerTrade:
      positionsClosed > 0
        ? (cumulativeProfitLoss[0] - cumulativeProfitLoss[1]) / positionsClosed
        : null,
    growthRate,
    maxHoldingPorportion: algorithmMaxHoldingProportion,
    positionsClosed,
    profitLossRatio,
    sharpeRatio: sharpeRatioCalculator.sharpe(yearsBetweenStartAndEnd),
    tickers,
    timespan,
    tradesMade: trades,
    volatility: sharpeRatioCalculator.volatility(),
    winRate:
      winsLosses[0] + winsLosses[1] > 0 ? winsLosses[0] / (winsLosses[0] + winsLosses[1]) : null,
  };

  const performance = await performanceFn(descriptionMetrics);
  return {
    name,
    aggregate,
    descriptionMetrics,
    algorithmPlot,
    performance,
  };
}
