import type { Bar } from '@/backtesting/read-data';
import type { Ticker, Timestamp } from '@/fetch/fetch';

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

export type SimpleAlgorithm = {
  aggregate: Timestamp;
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  implementation: (context: Bar[], position: number) => Action;
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
    implementation: (context: Record<Ticker, Bar[]>, position: Record<Ticker, number>) =>
      ({
        [ticker]: implementation(context[ticker], position[ticker]),
      }) as Record<Ticker, Action>,
    name,
    tickers: [ticker],
  };
}
