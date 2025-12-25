import type { Indicator, IndicatorResultByIndicator } from '@api/algorithms/indicators/indicator';
import type { Bar } from '@api/backtesting/read-data';
import type { Ticker, Timestamp } from '@api/fetch/types';

export const enum Action {
  BUY,
  SELL,
  HOLD,
}

export type AlgorithmImplementation = (
  context: Record<Ticker, Bar[]>,
  positions: Record<Ticker, number>,
  indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
) => Record<Ticker, Action>;

export const DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION = 0.95;
export const ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT = 0.99;
export type Algorithm = {
  aggregate: Timestamp;
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  implementation: AlgorithmImplementation;
  indicators?: Indicator[];
  name: string;
  tickers: [Ticker, ...Ticker[]];
};

export type MarketInvariantAlgorithm = {
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  implementation: AlgorithmImplementation;
  indicators?: Indicator[];
  name: string;
};
export function createAlgorithmFromMarketInvariantAlgorithm(
  marketInvariantAlgorithm: MarketInvariantAlgorithm,
  aggregate: Timestamp,
  tickers: [Ticker, ...Ticker[]],
): Algorithm {
  const { algorithmMaxHoldingProportion, contextLength, implementation, indicators, name } =
    marketInvariantAlgorithm;
  return {
    aggregate,
    algorithmMaxHoldingProportion,
    contextLength,
    implementation,
    indicators,
    name,
    tickers,
  };
}
