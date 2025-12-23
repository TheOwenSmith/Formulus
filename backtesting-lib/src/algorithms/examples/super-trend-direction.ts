import { Action, type MarketInvariantAlgorithm } from '@/algorithms/algorithm';
import type { IndicatorMetadata } from '@/algorithms/indicators/indicator-metadata';
import { computeSuperTrend, Direction } from '@/algorithms/indicators/super-trend';
import type { Bar } from '@/backtesting/read-data';
import type { Ticker } from '@/fetch/types';

export const superTrendDirectionAlgorithm: MarketInvariantAlgorithm = {
  name: 'Super Trend Direction',
  contextLength: 11,
  implementation: (
    context: Record<Ticker, Bar[]>,
    _positions: Record<Ticker, number>,
    metadata: Record<Ticker, IndicatorMetadata>,
  ): Record<Ticker, Action> => {
    const result = {} as Record<Ticker, Action>;
    for (const ticker in context) {
      const { direction } = computeSuperTrend({
        bars: context[ticker],
        metadata: metadata[ticker],
      }).at(-1)!;
      result[ticker] = direction === Direction.UP ? Action.BUY : Action.SELL;
    }
    return result;
  },
};
