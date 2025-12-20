import type { AlgorithmMetadata } from '@/backtesting/algorithm-metadata';
import type { Bar } from '@/backtesting/read-data';
import type { Ticker, Timestamp } from '@/fetch/types';
import { Action, DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION, type Algorithm } from './algorithm';

export type SimpleAlgorithmImplementation = (
  context: Bar[],
  position: number,
  metadata: AlgorithmMetadata,
) => Action;

export type SimpleAlgorithm = {
  aggregate: Timestamp;
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  implementation: SimpleAlgorithmImplementation;
  name: string;
  ticker: Ticker;
};

export function createAlgorithmFromSimpleAlgorithm({
  aggregate,
  algorithmMaxHoldingProportion = DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION,
  contextLength,
  implementation,
  name,
  ticker,
}: SimpleAlgorithm): Algorithm {
  return {
    aggregate,
    algorithmMaxHoldingProportion,
    contextLength,
    implementation: (
      context: Record<Ticker, Bar[]>,
      position: Record<Ticker, number>,
      algorithmMetadata: AlgorithmMetadata,
    ) =>
      ({
        [ticker]: implementation(context[ticker], position[ticker], algorithmMetadata),
      }) as Record<Ticker, Action>,
    name,
    tickers: [ticker],
  };
}

export type SimpleMarketInvariantAlgorithm = {
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  implementation: SimpleAlgorithmImplementation;
  name: string;
};
export function createAlgorithmFromSimpleMarketInvariantAlgorithm(
  marketInvariantAlgorithm: SimpleMarketInvariantAlgorithm,
  aggregate: Timestamp,
  ticker: Ticker,
) {
  return createAlgorithmFromSimpleAlgorithm({
    aggregate,
    algorithmMaxHoldingProportion: marketInvariantAlgorithm.algorithmMaxHoldingProportion,
    contextLength: marketInvariantAlgorithm.contextLength,
    implementation: marketInvariantAlgorithm.implementation,
    name: marketInvariantAlgorithm.name,
    ticker,
  });
}
