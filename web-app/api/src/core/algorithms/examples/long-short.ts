import { Action, type Algorithm } from '@api/core/algorithms/algorithm';
import type { IndicatorResultByIndicator } from '@api/core/algorithms/indicators/indicator';
import type { Bar, Ticker } from '@api/fetch/types';

export const longShortAlgorithm: Algorithm = {
  aggregate: '60min',
  contextLength: 15,
  implementation: (
    _context: Record<Ticker, Bar[]>,
    positions: Record<Ticker, number>,
    indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
  ): Record<Ticker, Action> => {
    const haveSH = positions['SH'] > 0;

    const spyRSI = indicators['SPY']['RSI(14)']!.at(-1)!;
    if (spyRSI < 25) {
      return { SPY: Action.BUY, SH: Action.SELL } as Record<Ticker, Action>;
    }

    if (haveSH) {
      if (spyRSI < 50) {
        return { SPY: Action.HOLD, SH: Action.SELL } as Record<Ticker, Action>;
      } else {
        return { SPY: Action.HOLD, SH: Action.HOLD } as Record<Ticker, Action>;
      }
    }

    if (spyRSI > 85) {
      return { SPY: Action.SELL, SH: Action.BUY } as Record<Ticker, Action>;
    } else if (spyRSI > 75) {
      return { SPY: Action.SELL, SH: Action.HOLD } as Record<Ticker, Action>;
    }

    return { SPY: Action.HOLD, SH: Action.HOLD } as Record<Ticker, Action>;
  },
  indicators: ['RSI(14)'],
  name: 'Long/Short',
  tickers: ['SPY', 'SH'],
};
