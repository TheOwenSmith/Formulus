import { Action, type MarketInvariantAlgorithm } from '@/algorithms/algorithm';
import type { IndicatorResultByIndicator } from '@/algorithms/indicators/indicator';
import { Direction } from '@/algorithms/indicators/super-trend';
import type { Bar } from '@/backtesting/read-data';
import type { Ticker } from '@/fetch/types';

export const superTrendDirectionAlgorithm: MarketInvariantAlgorithm = {
  name: 'Super Trend Direction',
  contextLength: 11,
  indicators: ['SuperTrend(10,3)'],
  implementation: (
    context: Record<Ticker, Bar[]>,
    _positions: Record<Ticker, number>,
    indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
  ): Record<Ticker, Action> => {
    const result = {} as Record<Ticker, Action>;
    for (const ticker in context) {
      const { direction } = indicators[ticker]['SuperTrend(10,3)']!.at(-1)!;
      result[ticker] = direction === Direction.UP ? Action.BUY : Action.SELL;
    }
    return result;
  },
};
