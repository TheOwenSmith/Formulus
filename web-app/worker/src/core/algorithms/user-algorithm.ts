import { tickerSchema, timestampSchema, type Ticker } from '@shared/api';
import { ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT } from '@shared/constants';
import { MAX_INDICATORS_COUNT } from '@shared/trading-constants';
import { actionSchema } from '@worker/core/algorithms/algorithm';
import { supportedLanguageSchema } from '@worker/core/backtesting/rpc/languages';
import z from 'zod';
import { USER_ALGORITHM_IMPLEMENTATION_CODE_MAX_LENGTH_BYTES } from './constants';
import { indicatorSchema } from './indicators/indicator';
import type { UserSimpleAlgorithm } from './user-simple-algorithm';
import type { UserTopKAlgorithm } from './user-top-k-algorithm';

export type AnyUserAlgorithmType = UserAlgorithm | UserSimpleAlgorithm | UserTopKAlgorithm;

export enum AlgorithmType {
  NORMAL,
  SIMPLE,
  TOP_K,
}

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
        message: `Name for algorithm must not contain 'runner' or 'utils'`,
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

export const rpcUserAlgorithmResponseSchemaFromTickers = (tickers: Ticker[]) =>
  z.partialRecord(tickerSchema, actionSchema).superRefine((result, ctx) => {
    const missingTickers = new Set<Ticker>(tickers);
    for (const ticker in result) {
      const tickerWasInSet = missingTickers.delete(ticker);
      if (!tickerWasInSet) {
        ctx.addIssue({
          code: 'custom',
          input: result,
          message: `Got information for ticker '${ticker}', but it was not in list of expected tickers (${Array.from(missingTickers).join(', ')})`,
        });
      }
    }
    if (missingTickers.size > 0) {
      ctx.addIssue({
        code: 'custom',
        input: result,
        message: `Missing information for tickers (${Array.from(missingTickers).join(', ')})`,
      });
    }
  });
