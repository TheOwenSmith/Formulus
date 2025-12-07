import {
  DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION,
  type Algorithm,
} from '@/algorithms/create-simple-algorithm';
import type { Ticker, Timestamp } from '@/fetch/fetch';
import type { SimplePlot } from '@/lib/nodeplotlib';
import type { SelectionOption } from '@/utils/cli';
import { type Day } from '@/utils/date-utils';
import { withCommasRounded } from '@/utils/number-utils';
import {
  MAX_POINTS_PER_PLOT,
  type AlgorithmData,
  type SelectionOptionWithPerformance,
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

export function getTickerSelectionOption({
  aggregate,
  ticker,
  tickerYs,
  xs,
}: {
  aggregate: Timestamp;
  ticker: Ticker;
  tickerYs: number[];
  xs: number[];
}): SelectionOption<SimplePlot> {
  const tickerPlot: SimplePlot = {
    name: ticker,
    x: xs,
    y: tickerYs,
    type: 'scatter',
  };
  return {
    name: `${ticker} (${aggregate})`,
    value: tickerPlot,
  };
}

export type DescriptionMetrics = {
  aggregate: Timestamp;
  algorithmReturnPercentage: number;
  contextLength: number;
  growthRatePercentage: number;
  maxHoldingPercentage: number;
  positionsClosed: number;
  profitLossRatio: number;
  sharpeRatio: number;
  tickers: Ticker[];
  timespan: [Day, Day];
  tradesMade: number;
  winRate: number;
};

export async function getAlgorithmSelectionOptionWithPerformance({
  aggregate,
  algorithm,
  algorithmData,
  performanceFn = (descriptionMetrics: DescriptionMetrics) =>
    descriptionMetrics.growthRatePercentage,
  timespan,
  xs,
  yearsBetweenStartAndEnd,
}: {
  aggregate: Timestamp;
  algorithm: Algorithm;
  algorithmData: AlgorithmData;
  performanceFn?: (descriptionMetrics: DescriptionMetrics) => number | Promise<number>;
  timespan: [Day, Day];
  xs: number[];
  yearsBetweenStartAndEnd: number;
}): Promise<
  SelectionOptionWithPerformance<{
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
    algorithmYs,
  } = algorithmData;

  const algorithmPlot: SimplePlot = {
    name: 'Algorithm',
    x: xs,
    y: algorithmYs,
    type: 'scatter',
  };

  const algorithmReturnPercentage = balance - 100;
  const growthRatePercentage = (Math.pow(balance / 100, 1 / yearsBetweenStartAndEnd) - 1) * 100;

  const descriptionMetrics: DescriptionMetrics = {
    aggregate,
    algorithmReturnPercentage,
    contextLength,
    growthRatePercentage,
    maxHoldingPercentage: algorithmMaxHoldingProportion * 100,
    positionsClosed,
    profitLossRatio: cumulativeProfitLoss[0] / cumulativeProfitLoss[1],
    sharpeRatio: sharpeRatioCalculator.sharpe(yearsBetweenStartAndEnd),
    tickers,
    timespan,
    tradesMade: trades,
    winRate: (winsLosses[0] / (winsLosses[0] + winsLosses[1])) * 100,
  };

  const performance = await performanceFn(descriptionMetrics);

  return {
    name: `${name}; Return: ${withCommasRounded(algorithmReturnPercentage)}% (${withCommasRounded(growthRatePercentage)}% APY) - ${aggregate}`,
    value: {
      name,
      aggregate,
      descriptionMetrics,
      algorithmPlot,
    },
    performance,
  };
}
