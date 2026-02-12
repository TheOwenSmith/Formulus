import type { Bar, Ticker, Timestamp } from '@shared/api';
import { Heap } from '@worker/utils/heap';
import { Action, DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION, type Algorithm } from './algorithm';
import type { Indicator, IndicatorResultByIndicator } from './indicators/indicator';

export type TopKAlgorithmImplementation = (
  context: Record<Ticker, Bar[]>,
  positions: Record<Ticker, number>,
  indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
) => Promise<Record<Ticker, number>>;

export type TopKAlgorithm = {
  aggregate: Timestamp;
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  implementation: TopKAlgorithmImplementation;
  indicators?: Indicator[];
  k: number;
  name: string;
  tickers: [Ticker, ...Ticker[]];
};

export function scoresToActionsTopKAlgorithm(
  scoresByTicker: Record<Ticker, number>,
  positions: Record<Ticker, number>,
  k: number,
): Record<Ticker, Action> {
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

export function createAlgorithmFromTopKAlgorithm({
  aggregate,
  algorithmMaxHoldingProportion = DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION,
  contextLength,
  implementation,
  indicators,
  k,
  name,
  tickers,
}: TopKAlgorithm): Algorithm {
  async function algorithmImplementation(
    context: Record<Ticker, Bar[]>,
    positions: Record<Ticker, number>,
    indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
  ) {
    const scoresByTicker: Record<Ticker, number> = await implementation(
      context,
      positions,
      indicators,
    );
    return scoresToActionsTopKAlgorithm(scoresByTicker, positions, k);
  }

  return {
    aggregate,
    algorithmMaxHoldingProportion,
    contextLength,
    implementation: algorithmImplementation,
    indicators,
    name,
    tickers,
  };
}

export type TopKMarketInvariantAlgorithm = {
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  implementation: TopKAlgorithmImplementation;
  indicators?: Indicator[];
  k: number;
  name: string;
};
export function createAlgorithmFromTopKMarketInvariantAlgorithm(
  marketInvariantAlgorithm: TopKMarketInvariantAlgorithm,
  aggregate: Timestamp,
  tickers: [Ticker, ...Ticker[]],
) {
  const { algorithmMaxHoldingProportion, contextLength, implementation, indicators, k, name } =
    marketInvariantAlgorithm;
  return createAlgorithmFromTopKAlgorithm({
    aggregate,
    algorithmMaxHoldingProportion,
    contextLength,
    implementation,
    indicators,
    k,
    name,
    tickers,
  });
}
