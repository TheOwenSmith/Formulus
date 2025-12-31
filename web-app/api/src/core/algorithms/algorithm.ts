import type { Bar, Ticker, Timestamp } from '@api/fetch/types';
import { tickerSchema, timestampSchema } from '@api/fetch/types';
import z from 'zod';
import {
  indicatorSchema,
  type Indicator,
  type IndicatorResultByIndicator,
} from './indicators/indicator';

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

export const userAlgorithmSchema = z
  .object({
    aggregate: timestampSchema,
    algorithmMaxHoldingProportion: z
      .number()
      .min(0)
      .max(ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT)
      .optional(),
    contextLength: z.int(),
    indicators: indicatorSchema.array().optional(),
    name: z.string().min(1).max(64),
    tickers: tickerSchema.array(),
    userAlgorithmImplementationCode: z.string(),
  })
  .superRefine(({ tickers, name, indicators }, ctx) => {
    if (new Set(tickers).size !== tickers.length) {
      ctx.addIssue({
        code: 'custom',
        input: tickers,
        message: `Tickers for algorithm '${name}' must be distinct`,
      });
    }

    if (indicators != undefined && new Set(indicators).size !== indicators.length) {
      ctx.addIssue({
        code: 'custom',
        input: indicators,
        message: `Indicators for algorithm '${name}' must be distinct`,
      });
    }
  });

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
