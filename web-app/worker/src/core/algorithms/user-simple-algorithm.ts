import { tickerSchema, timestampSchema, type Bar, type Ticker } from '@shared/api';
import { Action, ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT } from '@worker/core/algorithms/algorithm';
import {
  indicatorSchema,
  type IndicatorResultByIndicator,
} from '@worker/core/algorithms/indicators/indicator';
import { supportedLanguageSchema } from '@worker/core/backtesting/rpc/languages';
import z from 'zod';
import { USER_ALGORITHM_IMPLEMENTATION_CODE_MAX_LENGTH_BYTES } from './constants';
import type { InputTransformer, OutputTransformer } from './pipeline';
import {
  AlgorithmType,
  userAlgorithmNameSchema,
  type AnyUserAlgorithmType,
} from './user-algorithm';

export const userSimpleAlgorithmSchema = z
  .object({
    aggregate: timestampSchema,
    algorithmMaxHoldingProportion: z
      .number()
      .min(0)
      .max(ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT)
      .optional(),
    contextLength: z.int().positive(),
    indicators: indicatorSchema.array().optional(),
    language: supportedLanguageSchema,
    name: userAlgorithmNameSchema,
    ticker: tickerSchema,
    type: z.literal(AlgorithmType.SIMPLE),
    userAlgorithmImplementationCode: z
      .string()
      .max(USER_ALGORITHM_IMPLEMENTATION_CODE_MAX_LENGTH_BYTES),
  })
  .superRefine(({ name, indicators }, ctx) => {
    if (indicators != undefined && new Set(indicators).size !== indicators.length) {
      ctx.addIssue({
        code: 'custom',
        input: indicators,
        message: `Indicators for algorithm '${name}' must be distinct`,
      });
    }
  });
export type UserSimpleAlgorithm = z.infer<typeof userSimpleAlgorithmSchema>;

export const userSimpleAlgorithmInputTransformer: InputTransformer = (
  context: Record<Ticker, Bar[]>,
  positions: Record<Ticker, number>,
  indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
  userAlgorithm: AnyUserAlgorithmType,
): [Bar[], number, Partial<IndicatorResultByIndicator>] => {
  const { ticker } = userAlgorithm as UserSimpleAlgorithm;
  return [context[ticker], positions[ticker], indicators[ticker]];
};

export const userSimpleAlgorithmOutputTransformer: OutputTransformer = (
  userResponse: Action,
  userAlgorithm: AnyUserAlgorithmType,
  _positions: Record<Ticker, number>,
): Record<Ticker, Action> => {
  const { ticker } = userAlgorithm as UserSimpleAlgorithm;
  return { [ticker]: userResponse } as Record<Ticker, Action>;
};
