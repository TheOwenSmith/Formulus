import { tickerSchema, type Bar, type Ticker } from '@shared/api';
import { Action } from '@worker/core/algorithms/algorithm';
import { type IndicatorResultByIndicator } from '@worker/core/algorithms/indicators/indicator';
import z from 'zod';
import { USER_ALGORITHM_IMPLEMENTATION_CODE_MAX_LENGTH_BYTES } from './constants';
import type { InputTransformer, OutputTransformer } from './pipeline';
import {
  AlgorithmType,
  userAlgorithmSchemaBase,
  type AnyUserAlgorithmType,
} from './user-algorithm';

export const userSimpleAlgorithmSchema = userAlgorithmSchemaBase
  .extend({
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
