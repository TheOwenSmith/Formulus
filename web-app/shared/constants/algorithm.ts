import type { AnyUserAlgorithmType } from '@shared/schemas/algorithms/user-algorithm';
import { Indicator, IndicatorResultByIndicator } from './indicators/indicator';
import type { Bar, Ticker, Timestamp } from './trading';

export const enum Action {
  BUY = 0,
  SELL = 1,
  HOLD = 2,
}

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

export const USER_ALGORITHM_IMPLEMENTATION_CODE_MAX_LENGTH_BYTES = 1024 * 1024; // 1MB
export function getTickers(algorithm: Algorithm | AnyUserAlgorithmType): Ticker[] {
  return 'tickers' in algorithm ? algorithm.tickers : [algorithm.ticker];
}
