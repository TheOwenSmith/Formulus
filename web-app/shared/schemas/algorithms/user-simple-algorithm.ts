import { USER_ALGORITHM_IMPLEMENTATION_CODE_MAX_LENGTH_BYTES } from '@shared/constants/algorithm';
import { AlgorithmType } from '@shared/constants/trading';
import { tickerSchema } from '@shared/schemas/trading';
import z from 'zod';
import { userAlgorithmSchemaBase } from './user-algorithm';

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
