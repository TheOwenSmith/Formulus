import type { Indicator, IndicatorResultByIndicator } from '@shared/constants/indicators/indicator';
import type { Bar, Ticker } from '@shared/constants/trading';
import { type Timestamp } from '@shared/constants/trading';
import z from 'zod';

export const enum Action {
  BUY = 0,
  SELL = 1,
  HOLD = 2,
}
export const actionSchema = z.union([
  z.literal(Action.BUY),
  z.literal(Action.SELL),
  z.literal(Action.HOLD),
]);

export type AlgorithmImplementation = (
  context: Record<Ticker, Bar[]>,
  positions: Record<Ticker, number>,
  indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
) => Promise<Record<Ticker, Action>>;

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
