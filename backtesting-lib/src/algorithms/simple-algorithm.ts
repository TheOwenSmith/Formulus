import type { Bar } from '@/backtesting/read-data';
import type { Ticker, Timestamp } from '@/fetch/fetch';
import { Action, DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION, type Algorithm } from './algorithm';

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
