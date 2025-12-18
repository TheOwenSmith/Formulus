import { Action, type MarketInvariantAlgorithm } from '@/algorithms/algorithm';
import { computeSuperTrend, Direction } from '@/algorithms/indicators/super-trend';
import type { Bar } from '@/backtesting/read-data';
import type { Ticker } from '@/fetch/types';

export const superTrendDirectionAlgorithm: MarketInvariantAlgorithm = {
  name: 'Super Trend Direction',
  contextLength: 11,
  implementation: (
    context: Record<Ticker, Bar[]>,
    _positions: Record<Ticker, number>,
  ): Record<Ticker, Action> => {
    const result = {} as Record<Ticker, Action>;
    for (const ticker in context) {
      const { direction } = computeSuperTrend(context[ticker]).at(-1)!;
      result[ticker] = direction === Direction.UP ? Action.BUY : Action.SELL;
    }
    return result;
  },
};
