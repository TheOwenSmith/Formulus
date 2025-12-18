import type { Bar } from '@/backtesting/read-data';
import type { Ticker, Timestamp } from '@/fetch/types';

export const enum Action {
  BUY,
  SELL,
  HOLD,
}

export type AlgorithmImplementation = (
  context: Record<Ticker, Bar[]>,
  positions: Record<Ticker, number>,
) => Record<Ticker, Action>;

export const DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION = 0.95;
export const ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT = 0.99;
export type Algorithm = {
  aggregate: Timestamp;
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  implementation: AlgorithmImplementation;
  name: string;
  tickers: [Ticker, ...Ticker[]];
};

export type MarketInvariantAlgorithm = {
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  implementation: AlgorithmImplementation;
  name: string;
};
export function createAlgorithmFromMarketInvariantAlgorithm(
  marketInvariantAlgorithm: MarketInvariantAlgorithm,
  aggregate: Timestamp,
  tickers: [Ticker, ...Ticker[]],
): Algorithm {
  return {
    aggregate,
    algorithmMaxHoldingProportion: marketInvariantAlgorithm.algorithmMaxHoldingProportion,
    contextLength: marketInvariantAlgorithm.contextLength,
    implementation: marketInvariantAlgorithm.implementation,
    name: marketInvariantAlgorithm.name,
    tickers,
  };
}
