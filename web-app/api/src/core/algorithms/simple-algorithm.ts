import { type Bar, type Ticker, type Timestamp } from '@api/fetch/types';
import { Action, DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION, type Algorithm } from './algorithm';
import { type Indicator, type IndicatorResultByIndicator } from './indicators/indicator';

export type SimpleAlgorithmImplementation = (
  context: Bar[],
  position: number,
  indicators: Partial<IndicatorResultByIndicator>,
) => Promise<Action>;

export type SimpleAlgorithm = {
  aggregate: Timestamp;
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  implementation: SimpleAlgorithmImplementation;
  indicators?: Indicator[];
  name: string;
  ticker: Ticker;
};

export function createAlgorithmFromSimpleAlgorithm({
  aggregate,
  algorithmMaxHoldingProportion = DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION,
  contextLength,
  implementation,
  indicators,
  name,
  ticker,
}: SimpleAlgorithm): Algorithm {
  return {
    aggregate,
    algorithmMaxHoldingProportion,
    contextLength,
    implementation: async (
      context: Record<Ticker, Bar[]>,
      position: Record<Ticker, number>,
      indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
    ) =>
      ({
        [ticker]: await implementation(context[ticker], position[ticker], indicators[ticker]),
      }) as Record<Ticker, Action>,
    indicators,
    name,
    tickers: [ticker],
  };
}

export type SimpleMarketInvariantAlgorithm = {
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  implementation: SimpleAlgorithmImplementation;
  indicators?: Indicator[];
  name: string;
};
export function createAlgorithmFromSimpleMarketInvariantAlgorithm(
  marketInvariantAlgorithm: SimpleMarketInvariantAlgorithm,
  aggregate: Timestamp,
  ticker: Ticker,
) {
  const { algorithmMaxHoldingProportion, contextLength, implementation, indicators, name } =
    marketInvariantAlgorithm;
  return createAlgorithmFromSimpleAlgorithm({
    aggregate,
    algorithmMaxHoldingProportion,
    contextLength,
    implementation,
    indicators,
    name,
    ticker,
  });
}
