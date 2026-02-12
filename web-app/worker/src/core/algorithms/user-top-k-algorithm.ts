import { tickerSchema, timestampSchema, type Ticker } from '@shared/api';
import { Action, ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT } from '@worker/core/algorithms/algorithm';
import { indicatorSchema } from '@worker/core/algorithms/indicators/indicator';
import { supportedLanguageSchema } from '@worker/core/backtesting/rpc/languages';
import z from 'zod';
import { USER_ALGORITHM_IMPLEMENTATION_CODE_MAX_LENGTH_BYTES } from './constants';
import type { OutputTransformer } from './pipeline';
import { scoresToActionsTopKAlgorithm } from './top-k-algorithm';
import { AlgorithmType, type AnyUserAlgorithmType } from './user-algorithm';

export const userTopKAlgorithmSchema = z
  .object({
    aggregate: timestampSchema,
    algorithmMaxHoldingProportion: z
      .number()
      .min(0)
      .max(ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT)
      .optional(),
    contextLength: z.int().positive(),
    indicators: indicatorSchema.array().optional(),
    k: z.int().positive().min(1),
    language: supportedLanguageSchema,
    name: z.string().min(1).max(64),
    tickers: tickerSchema.array().min(1),
    type: z.literal(AlgorithmType.TOP_K),
    userAlgorithmImplementationCode: z
      .string()
      .max(USER_ALGORITHM_IMPLEMENTATION_CODE_MAX_LENGTH_BYTES),
  })
  .superRefine(({ tickers, name, indicators, k }, ctx) => {
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

    if (k > tickers.length) {
      ctx.addIssue({
        code: 'custom',
        input: k,
        message: `K for algorithm '${name}' must be less than or equal to the number of tickers (${tickers.length})`,
      });
    }
  });
export type UserTopKAlgorithm = z.infer<typeof userTopKAlgorithmSchema>;

export const rpcUserTopKAlgorithmResponseSchemaFromTickers = (tickers: Ticker[]) =>
  z.partialRecord(tickerSchema, z.number()).superRefine((result, ctx) => {
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

export const userTopKAlgorithmOutputTransformer: OutputTransformer = (
  scoreByTicker: Record<Ticker, number>,
  userAlgorithm: AnyUserAlgorithmType,
  positions: Record<Ticker, number>,
): Record<Ticker, Action> => {
  const { k } = userAlgorithm as UserTopKAlgorithm;
  return scoresToActionsTopKAlgorithm(scoreByTicker, positions, k);
};
