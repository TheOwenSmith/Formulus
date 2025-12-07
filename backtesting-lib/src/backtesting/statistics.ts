import {
  DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION,
  type Algorithm,
} from '@/algorithms/create-simple-algorithm';
import type { DescriptionMetrics } from '@/algorithms/plot';
import type { Ticker, Timestamp } from '@/fetch/fetch';
import type { SimplePlot } from '@/lib/nodeplotlib';
import type { SelectionOption } from '@/utils/cli';
import { dayToString, type Day } from '@/utils/date-utils';
import { withCommas, withCommasRounded } from '@/utils/number-utils';
import {
  MAX_POINTS_PER_PLOT,
  type AlgorithmData,
  type SelectionOptionWithPerformance,
} from './backtest-algorithms-concurrently';
import { tickersToString } from './ticker-utils';

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
export function getAlgorithmSelectionOptionWithPerformance({
  algorithmData,
  aggregate,
  yearsBetweenStartAndEnd,
  startDay,
  endDay,
  xs,
  algorithm,
}: {
  algorithmData: AlgorithmData;
  aggregate: Timestamp;
  yearsBetweenStartAndEnd: number;
  startDay: Day;
  endDay: Day;
  xs: number[];
  algorithm: Algorithm;
}): SelectionOptionWithPerformance<{
  name: string;
  aggregate: Timestamp;
  descriptionMetrics: DescriptionMetrics;
  algorithmPlot: SimplePlot;
}> {
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

  const returnPercentage = balance - 100;
  const growthRatePercentage = (Math.pow(balance / 100, 1 / yearsBetweenStartAndEnd) - 1) * 100;
  const sharpRatio = sharpeRatioCalculator.sharpe(yearsBetweenStartAndEnd);
  const winPercentage = (winsLosses[0] / (winsLosses[0] + winsLosses[1])) * 100;
  const profitLossRatio = cumulativeProfitLoss[0] / cumulativeProfitLoss[1];
  const profitLossRatioString =
    profitLossRatio !== Infinity ? `${withCommasRounded(profitLossRatio)}:1` : '1:0';

  const descriptionMetrics: DescriptionMetrics = {
    aggregate: `Aggregate: ${aggregate}`,
    algorithmReturn: `Algorithm return: ${withCommasRounded(returnPercentage)}%`,
    contextLength: `Context length: ${withCommas(contextLength)}`,
    growthRate: `Growth rate: ${withCommasRounded(growthRatePercentage)}%`,
    maxHoldingPercentage: `Max holding percentage: ${algorithmMaxHoldingProportion * 100}%`,
    positionsClosed: `Positions closed: ${withCommas(positionsClosed)}`,
    profitLossRatio: `Profit/loss ratio: ${profitLossRatioString}`,
    sharpeRatio: `Sharpe ratio: ${withCommasRounded(sharpRatio)}`,
    tickers: `Tickers: ${tickersToString(tickers)}`,
    timespan: `Timespan: ${dayToString(startDay)} to ${dayToString(endDay!)}`,
    tradesMade: `Trades made: ${withCommas(trades)}`,
    winRate: `Win rate: ${withCommasRounded(winPercentage)}%`,
  };

  return {
    name: `${name}; Return: ${withCommasRounded(returnPercentage)}% (${withCommasRounded(growthRatePercentage)}% APY) - ${aggregate}`,
    value: {
      name,
      aggregate,
      descriptionMetrics,
      algorithmPlot,
    },
    performance: growthRatePercentage,
  };
}
