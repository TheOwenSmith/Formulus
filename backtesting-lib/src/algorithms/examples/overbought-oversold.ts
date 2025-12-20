import { Action, type MarketInvariantAlgorithm } from '@/algorithms/algorithm';
import { computeRSI } from '@/algorithms/indicators/rsi';
import type { AlgorithmMetadata } from '@/backtesting/algorithm-metadata';
import type { Bar } from '@/backtesting/read-data';
import type { Ticker } from '@/fetch/types';

export const overboughtOversoldAlgorithm: MarketInvariantAlgorithm = {
  name: 'Overbought/Oversold',
  contextLength: 15,
  implementation: (
    context: Record<Ticker, Bar[]>,
    _positions: Record<Ticker, number>,
    metadata: AlgorithmMetadata,
  ): Record<Ticker, Action> => {
    const result = {} as Record<Ticker, Action>;
    for (const ticker in context) {
      const rsi = computeRSI({ bars: context[ticker], metadata }).at(-1)!;

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
