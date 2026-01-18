import {
  actionSchema,
  ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT,
} from '@api/core/algorithms/algorithm';
import { indicatorSchema } from '@api/core/algorithms/indicators/indicator';
import { supportedLanguageSchema } from '@api/core/backtesting/rpc/languages';
import { tickerSchema, timestampSchema, type Ticker } from '@api/fetch/types';
import z from 'zod';
import { USER_ALGORITHM_IMPLEMENTATION_CODE_MAX_LENGTH_BYTES } from './constants';
import type { UserSimpleAlgorithm } from './user-simple-algorithm';
import type { UserTopKAlgorithm } from './user-top-k-algorithm';

export type AnyUserAlgorithmType = UserAlgorithm | UserSimpleAlgorithm | UserTopKAlgorithm;

export enum AlgorithmType {
  NORMAL,
  SIMPLE,
  TOP_K,
}

export const userAlgorithmSchema = z
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
    name: z.string().min(1).max(64),
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
