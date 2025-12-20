import { Action, type MarketInvariantAlgorithm } from '@/algorithms/algorithm';
import { computeSuperTrend, Direction } from '@/algorithms/indicators/super-trend';
import type { AlgorithmMetadata } from '@/backtesting/algorithm-metadata';
import type { Bar } from '@/backtesting/read-data';
import type { Ticker } from '@/fetch/types';

export const superTrendDirectionAlgorithm: MarketInvariantAlgorithm = {
  name: 'Super Trend Direction',
  contextLength: 11,
  implementation: (
    context: Record<Ticker, Bar[]>,
    _positions: Record<Ticker, number>,
    metadata: AlgorithmMetadata,
  ): Record<Ticker, Action> => {
    const result = {} as Record<Ticker, Action>;
    for (const ticker in context) {
      const { direction } = computeSuperTrend({ bars: context[ticker], metadata }).at(-1)!;
      result[ticker] = direction === Direction.UP ? Action.BUY : Action.SELL;
    }
    return result;
  },
};
