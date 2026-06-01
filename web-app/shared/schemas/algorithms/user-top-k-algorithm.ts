import { USER_ALGORITHM_IMPLEMENTATION_CODE_MAX_LENGTH_BYTES } from '@shared/constants/algorithm';
import { tickerSchema } from '@shared/schemas/trading';
import z from 'zod';
import { AlgorithmType, userAlgorithmSchemaBase } from './user-algorithm';

export const userTopKAlgorithmSchema = userAlgorithmSchemaBase
  .extend({
    k: z.int().positive().min(1),
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
