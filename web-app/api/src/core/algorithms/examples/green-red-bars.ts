import type { Algorithm } from '@api/core/algorithms/algorithm';
import { createTopKAlgorithmFromContextMaps } from '@api/core/algorithms/context-maps/context-map';
import { createAlgorithmFromTopKAlgorithm } from '@api/core/algorithms/top-k-algorithm';
import type { Bar, Ticker, Timestamp } from '@api/fetch/types';

export const greenRedBarsAlgorithm = ({
  aggregate,
  algorithmMaxHoldingProportion,
  contextLength,
  contextMapByTicker,
  k,
  name,
  tickers,
}: {
  aggregate: Timestamp;
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  contextMapByTicker: Record<Ticker, Map<number, number>>;
  k: number;
  name?: string;
  tickers: [Ticker, ...Ticker[]];
}): Algorithm =>
  createAlgorithmFromTopKAlgorithm(
    createTopKAlgorithmFromContextMaps({
      aggregate,
      algorithmMaxHoldingProportion,
      contextLength,
      contextMaps: contextMapByTicker,
      encodeContext: greenRedBarsMaskHistory,
      k,
      name: name ?? `TopK Green/Red Bars (${contextLength}-${k})`,
      tickers,
    }),
  );

export const greenRedBarsChooseKAlgorithm = ({
  aggregate,
  algorithmMaxHoldingProportion,
  contextLength,
  contextMapByTicker,
  k,
  name,
  tickers,
}: {
  aggregate: Timestamp;
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  contextMapByTicker: Record<Ticker, Map<number, number>>;
  k: number;
  name?: string;
  tickers: [Ticker, ...Ticker[]];
}): Algorithm =>
  createAlgorithmFromTopKAlgorithm(
    createTopKAlgorithmFromContextMaps({
      aggregate,
      algorithmMaxHoldingProportion,
      contextLength,
      contextMaps: contextMapByTicker,
      encodeContext: greenRedBarsMaskHistory,
      k,
      name: name ?? `TopK Green/Red Bars (${contextLength}-${k})`,
      tickers,
    }),
  );

export function greenRedBarsMaskHistory(context: Bar[]): number {
  return context.reduce((acc, bar: Bar, index: number) => {
    const isGreen = bar[4] >= bar[1];
    return isGreen ? acc | (1 << index) : acc;
  }, 0);
}
