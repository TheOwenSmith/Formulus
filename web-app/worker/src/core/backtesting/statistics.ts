import { getTickers, type Algorithm } from '@shared/constants/algorithm';
import type {
  DescriptionMetrics,
  ProfitLossRatio,
  SimplePlot,
  Timestamp,
} from '@shared/constants/trading';
import { DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION } from '@shared/constants/trading';
import type { AnyUserAlgorithmType } from '@shared/schemas/algorithms/user-algorithm';
import { type AlgorithmData } from './backtest-algorithms-concurrently';
import { MAX_POINTS_PER_PLOT } from './constants';

export function updateGraph<T, P>({
  graphIndex,
  graphObject,
  newPoint,
}: {
  graphObject: T;
  // keys of T that have P[] values
  graphIndex: { [K in keyof T]: T[K] extends P[] ? K : never }[keyof T];
  newPoint: P;
}): boolean {
  const graph = graphObject[graphIndex] as P[];
  graph.push(newPoint);

  if (graph.length > MAX_POINTS_PER_PLOT) {
    // Reduce the number of points in the plot by half
    const reducedGraph: P[] = [];
    for (let j = 0; j < graph.length; j += 2) {
      reducedGraph.push(graph[j]);
    }
    (graphObject[graphIndex] as P[]) = reducedGraph;
    return true;
  }
  return false;
}

export async function getAlgorithmGraph({
  aggregate,
  algorithm,
  algorithmData,
  timespan,
  yearsBetweenStartAndEnd,
}: {
  aggregate: Timestamp;
  algorithm: Algorithm | AnyUserAlgorithmType;
  algorithmData: AlgorithmData;
  performanceFn?: (descriptionMetrics: DescriptionMetrics) => number | Promise<number>;
  timespan: [string, string];
  yearsBetweenStartAndEnd: number;
}): Promise<{
  aggregate: Timestamp;
  descriptionMetrics: DescriptionMetrics;
  algorithmPlot: SimplePlot;
}> {
  const {
    contextLength,
    name,
    algorithmMaxHoldingProportion = DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION,
  } = algorithm;
  const tickers = getTickers(algorithm);

  const {
    balance,
    trades,
    winsLosses,
    cumulativeProfitLoss,
    positionsClosed,
    sharpeRatioCalculator,
    cumulativeHoldingTime,
    algorithmYs,
    maxDrawdown,
  } = algorithmData;

  const algorithmPlot: SimplePlot = {
    name,
    y: algorithmYs,
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
    maxDrawdown,
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

  return {
    aggregate,
    algorithmPlot,
    descriptionMetrics,
  };
}
