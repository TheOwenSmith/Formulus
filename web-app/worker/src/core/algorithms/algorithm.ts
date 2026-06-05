import type { Algorithm, AlgorithmImplementation } from '@shared/constants/algorithm';
import type { Indicator } from '@shared/constants/indicators/indicator';
import type { Ticker } from '@shared/constants/trading';
import { type Timestamp } from '@shared/constants/trading';

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
