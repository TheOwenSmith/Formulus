import type { Bar } from '@/backtesting/read-data';
import type { Ticker, Timestamp } from '@/fetch/fetch';
import { Heap } from '@/utils/heap';
import {
  Action,
  DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION,
  type Algorithm,
} from './create-simple-algorithm';

export type TopKAlgorithm = {
  aggregate: Timestamp;
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  implementation: (
    context: Record<Ticker, Bar[]>,
    positions: Record<Ticker, number>,
  ) => Record<Ticker, number>;
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
  ) {
    const scoresByTicker: Record<Ticker, number> = implementation(context, positions);
    const maxHeap = new Heap<[Ticker, number]>(
      (a: [Ticker, number], b: [Ticker, number]) => b[1] - a[1],
    );
    const result = {} as Record<Ticker, Action>;
    for (const ticker in scoresByTicker) {
      // Min heap has capacity of k
      if (maxHeap.size < k) {
        maxHeap.add([ticker, scoresByTicker[ticker]]);
      } else {
        // removeTicker is not top k score, so we sell or hold
        const removedTicker = maxHeap.pop()![0];
        result[removedTicker] = positions[removedTicker] > 0 ? Action.SELL : Action.HOLD;

        maxHeap.add([ticker, scoresByTicker[ticker]]);
      }
    }

    while (maxHeap.size > 0) {
      // removeTicker is not top k score, so we buy or hold
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
