import { Action, type MarketInvariantAlgorithm } from '@/algorithms/algorithm';
import type { IndicatorResultByIndicator } from '@/algorithms/indicators/indicator';
import type { Bar } from '@/backtesting/read-data';
import type { Ticker } from '@/fetch/types';

export const aboveBelowSmaAlgorithm: MarketInvariantAlgorithm = {
  name: 'Above/Below SMA',
  contextLength: 20,
  indicators: ['SMA(20)'],
  implementation: (
    context: Record<Ticker, Bar[]>,
    _positions: Record<Ticker, number>,
    indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
  ): Record<Ticker, Action> => {
    const result = {} as Record<Ticker, Action>;
    for (const ticker in context) {
      const sma = indicators[ticker]['SMA(20)']!.at(-1)!;
      const latestPrice = context[ticker].at(-1)![4];

      if (latestPrice > sma) {
        result[ticker] = Action.BUY;
      } else if (latestPrice < sma) {
        result[ticker] = Action.SELL;
      } else {
        result[ticker] = Action.HOLD;
      }
    }
    return result;
  },
};
