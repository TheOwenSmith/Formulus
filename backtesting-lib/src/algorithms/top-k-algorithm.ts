import type { IndicatorMetadata } from '@/algorithms/indicators/indicator-metadata';
import type { Bar } from '@/backtesting/read-data';
import type { Ticker, Timestamp } from '@/fetch/types';
import { Heap } from '@/utils/heap';
import { Action, DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION, type Algorithm } from './algorithm';

export type TopKAlgorithmImplementation = (
  context: Record<Ticker, Bar[]>,
  positions: Record<Ticker, number>,
  metadata: Record<Ticker, IndicatorMetadata>,
) => Record<Ticker, number>;

export type TopKAlgorithm = {
  aggregate: Timestamp;
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  implementation: TopKAlgorithmImplementation;
  k: number;
  name: string;
  tickers: [Ticker, ...Ticker[]];
};

export function createAlgorithmFromTopKAlgorithm({
  aggregate,
  algorithmMaxHoldingProportion = DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION,
  contextLength,
  implementation,
  k,
  name,
  tickers,
}: TopKAlgorithm): Algorithm {
  function algorithmImplementation(
    context: Record<Ticker, Bar[]>,
    positions: Record<Ticker, number>,
    metadata: Record<Ticker, IndicatorMetadata>,
  ) {
    const scoresByTicker: Record<Ticker, number> = implementation(context, positions, metadata);
    const maxHeap = new Heap<[Ticker, number]>(
      (a: [Ticker, number], b: [Ticker, number]) => a[1] - b[1],
    );
    const result = {} as Record<Ticker, Action>;
    for (const ticker in scoresByTicker) {
      maxHeap.add([ticker, scoresByTicker[ticker]]);

      // Min heap has capacity of k
      if (maxHeap.size > k) {
        // removeTicker is not top k score, so we sell or hold
        const removedTicker = maxHeap.pop()![0];
        result[removedTicker] = positions[removedTicker] > 0 ? Action.SELL : Action.HOLD;
      }
    }

    while (maxHeap.size > 0) {
      // removeTicker is top k score, so we buy or hold
      const removedTicker = maxHeap.pop()![0];
      result[removedTicker] = positions[removedTicker] > 0 ? Action.HOLD : Action.BUY;
    }
    return result;
  }

  return {
    aggregate,
    algorithmMaxHoldingProportion,
    contextLength,
    implementation: algorithmImplementation,
    name,
    tickers,
  };
}

export type TopKMarketInvariantAlgorithm = {
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  implementation: (
    context: Record<Ticker, Bar[]>,
    positions: Record<Ticker, number>,
  ) => Record<Ticker, number>;
  k: number;
  name: string;
};
export function createAlgorithmFromTopKMarketInvariantAlgorithm(
  marketInvariantAlgorithm: TopKMarketInvariantAlgorithm,
  aggregate: Timestamp,
  tickers: [Ticker, ...Ticker[]],
) {
  return createAlgorithmFromTopKAlgorithm({
    aggregate,
    algorithmMaxHoldingProportion: marketInvariantAlgorithm.algorithmMaxHoldingProportion,
    contextLength: marketInvariantAlgorithm.contextLength,
    implementation: marketInvariantAlgorithm.implementation,
    k: marketInvariantAlgorithm.k,
    name: marketInvariantAlgorithm.name,
    tickers,
  });
}
