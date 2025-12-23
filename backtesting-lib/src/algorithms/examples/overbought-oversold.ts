import { Action, type MarketInvariantAlgorithm } from '@/algorithms/algorithm';
import type { IndicatorMetadata } from '@/algorithms/indicators/indicator-metadata';
import { computeRSI } from '@/algorithms/indicators/rsi';
import type { Bar } from '@/backtesting/read-data';
import type { Ticker } from '@/fetch/types';

export const overboughtOversoldAlgorithm: MarketInvariantAlgorithm = {
  name: 'Overbought/Oversold',
  contextLength: 15,
  implementation: (
    context: Record<Ticker, Bar[]>,
    _positions: Record<Ticker, number>,
    metadata: Record<Ticker, IndicatorMetadata>,
  ): Record<Ticker, Action> => {
    const result = {} as Record<Ticker, Action>;
    for (const ticker in context) {
      const rsi = computeRSI({ bars: context[ticker], metadata: metadata[ticker] }).at(-1)!;

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
