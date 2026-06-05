import {
  Action,
  USER_ALGORITHM_IMPLEMENTATION_CODE_MAX_LENGTH_BYTES,
} from '@shared/constants/algorithm';
import { indicatorSchema } from '@shared/constants/indicators/indicator';
import {
  ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT,
  MAX_INDICATORS_COUNT,
  SUPPORTED_LANGUAGE_VALUES,
} from '@shared/constants/trading';
import { tickerSchema, timestampSchema } from '@shared/schemas/trading';
import z from 'zod';
import type { UserSimpleAlgorithm } from './user-simple-algorithm';
import type { UserTopKAlgorithm } from './user-top-k-algorithm';

export type AnyUserAlgorithmType = UserAlgorithm | UserSimpleAlgorithm | UserTopKAlgorithm;

export enum AlgorithmType {
  NORMAL,
  SIMPLE,
  TOP_K,
}

export const actionSchema = z.union([
  z.literal(Action.BUY),
  z.literal(Action.SELL),
  z.literal(Action.HOLD),
]);

export const supportedLanguageSchema = z.enum(SUPPORTED_LANGUAGE_VALUES);

export const userAlgorithmNameSchema = z
  .string()
  .min(4)
  .max(64)
  .superRefine((name, ctx) => {
    if (!/^[a-zA-Z0-9\-() ]+$/.test(name)) {
      ctx.addIssue({
        code: 'custom',
        input: name,
        message: `Name for algorithm must contain only letters, numbers, dashes, parentheses, and spaces`,
      });
    }
    if (name === 'runner' || name === 'utils') {
      ctx.addIssue({
        code: 'custom',
        input: name,
        message: `Name for algorithm must not be 'runner' or 'utils'`,
      });
    }
  });

export const userAlgorithmSchemaBase = z.object({
  aggregate: timestampSchema,
  algorithmMaxHoldingProportion: z
    .number()
    .min(0)
    .max(ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT)
    .superRefine((n, ctx) => {
      if (n.toString().length > 6) {
        ctx.addIssue({
          code: 'custom',
          input: n,
          message: `Algorithm max holding proportion cannot be more than 6 digits`,
        });
      }
    })
    .optional(),
  contextLength: z.int().positive(),
  // ensure no duplicate indicators
  indicators: z
    .array(indicatorSchema)
    .max(MAX_INDICATORS_COUNT)
    .superRefine((indicators, ctx) => {
      if (new Set(indicators).size !== indicators.length) {
        ctx.addIssue({
          code: 'custom',
          input: indicators,
          message: `Indicators must be distinct`,
        });
      }
    })
    .optional(),
  language: supportedLanguageSchema,
  name: userAlgorithmNameSchema,
});

export const userAlgorithmSchema = userAlgorithmSchemaBase
  .extend({
    tickers: tickerSchema.array().min(1),
    type: z.literal(AlgorithmType.NORMAL),
    userAlgorithmImplementationCode: z
      .string()
      .max(USER_ALGORITHM_IMPLEMENTATION_CODE_MAX_LENGTH_BYTES),
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
export type UserAlgorithm = z.infer<typeof userAlgorithmSchema>;
