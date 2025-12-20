import { Action, type Algorithm } from '@/algorithms/algorithm';
import { computeRSI } from '@/algorithms/indicators/rsi';
import type { AlgorithmMetadata } from '@/backtesting/algorithm-metadata';
import type { Bar } from '@/backtesting/read-data';
import type { Ticker } from '@/fetch/types';

export const longShortAlgorithm: Algorithm = {
  aggregate: '60min',
  contextLength: 15,
  implementation: (
    context: Record<Ticker, Bar[]>,
    positions: Record<Ticker, number>,
    metadata: AlgorithmMetadata,
  ): Record<Ticker, Action> => {
    const haveSH = positions['SH'] > 0;

    const spyRSI = computeRSI({ bars: context['SPY'], metadata }).at(-1)!;
    if (haveSH) {
      if (spyRSI < 45) {
        return { SPY: Action.BUY, SH: Action.SELL } as Record<Ticker, Action>;
      } else {
        return { SPY: Action.HOLD, SH: Action.SELL } as Record<Ticker, Action>;
      }
    }

    if (spyRSI < 30) {
      return { SPY: Action.BUY, SH: Action.SELL } as Record<Ticker, Action>;
    } else if (spyRSI > 90) {
      return { SPY: Action.SELL, SH: Action.BUY } as Record<Ticker, Action>;
    }

    // Would never happen (exhaustive check)
    return { SPY: Action.HOLD, SH: Action.SELL } as Record<Ticker, Action>;
  },
  name: 'Long/Short',
  tickers: ['SPY', 'SH'],
};
