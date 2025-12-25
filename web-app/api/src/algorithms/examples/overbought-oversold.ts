import { Action, type MarketInvariantAlgorithm } from '@/algorithms/algorithm';
import type { IndicatorResultByIndicator } from '@/algorithms/indicators/indicator';
import type { Bar } from '@/backtesting/read-data';
import type { Ticker } from '@/fetch/types';

export const overboughtOversoldAlgorithm: MarketInvariantAlgorithm = {
  name: 'Overbought/Oversold',
  contextLength: 15,
  indicators: ['RSI(14)'],
  implementation: (
    context: Record<Ticker, Bar[]>,
    _positions: Record<Ticker, number>,
    indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
  ): Record<Ticker, Action> => {
    const result = {} as Record<Ticker, Action>;
    for (const ticker in context) {
      const rsi = indicators[ticker]['RSI(14)']!.at(-1)!;

      if (rsi < 30) {
        result[ticker] = Action.BUY;
      } else if (rsi > 70) {
        result[ticker] = Action.SELL;
      } else {
        result[ticker] = Action.HOLD;
      }
    }
    return result;
  },
};
