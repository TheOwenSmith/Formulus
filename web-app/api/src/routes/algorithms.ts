import { type TRPCContext } from '@api/lib/trpc';
import type { createUserAuthenticationProcedure } from '@api/middleware/authentication';
import { indicatorsValidationForContextLength } from '@api/middleware/indicator';
import {
  deleteAlgorithmByIdForCreator,
  getAlgorithmByIdForCreator,
  getAlgorithmsByCreatorId,
  updateAlgorithmCode,
  updateAlgorithmIndicators,
  uploadAlgorithm,
} from '@api/repository/db-algorithm';
import { getResultAccessInfo } from '@api/repository/db-sharing';
import { getAlgorithmVersionsByResultPublicId } from '@api/repository/db-submission';
import { badRequest } from '@api/utils/error-handling';
import { indicatorSchema } from '@shared/constants/indicators/indicator';
import { MAX_INDICATORS_COUNT } from '@shared/constants/trading';
import { convertAlgorithmVersionToUserAlgorithm } from '@shared/db/algorithm-version';
import { userAlgorithmSchema } from '@shared/schemas/algorithms/user-algorithm';
import { userSimpleAlgorithmSchema } from '@shared/schemas/algorithms/user-simple-algorithm';
import { userTopKAlgorithmSchema } from '@shared/schemas/algorithms/user-top-k-algorithm';
import z from 'zod';

const anyAlgorithmSchema = z.union([
  userAlgorithmSchema,
  userSimpleAlgorithmSchema,
  userTopKAlgorithmSchema,
]);

export function algorithmsRouter(
  router: TRPCContext['router'],
  authProcedure: ReturnType<typeof createUserAuthenticationProcedure>,
) {
  return router({
    copyAlgorithmVersion: authProcedure
      .input(
        z.object({
          name: z
            .string()
            .min(4)
            .max(64)
            .regex(/^[a-zA-Z0-9\-() ]+$/),
          resultPublicId: z.string(),
          versionId: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { user } = ctx;
        const { name, resultPublicId, versionId } = input;

        // Verify copy access: owner or explicit share with allowCopy
        const accessResult = await getResultAccessInfo(resultPublicId, user.id);
        if (accessResult.isErr()) throw accessResult.error;
        if (!accessResult.value?.canCopy) {
          throw badRequest('You do not have permission to copy algorithms from this result');
        }

        // Get algorithm version
        const versionsResult = await getAlgorithmVersionsByResultPublicId(resultPublicId);
        if (versionsResult.isErr()) throw versionsResult.error;
        const version = versionsResult.value.find((v) => v.id === versionId);
        if (version == null) throw badRequest('Algorithm version not found');

        // Convert algorithm version to user algorithm and upload it
        const userAlgorithm = convertAlgorithmVersionToUserAlgorithm(version);
        userAlgorithm.name = name;
        const uploadResult = await uploadAlgorithm({
          algorithm: userAlgorithm,
          creatorId: user.id,
        });
        if (uploadResult.isErr()) throw uploadResult.error;
        return { id: uploadResult.value.id };
      }),

    createAlgorithm: authProcedure.input(anyAlgorithmSchema).mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const result = await uploadAlgorithm({ algorithm: input, creatorId: user.id });
      if (result.isErr()) throw result.error;
      return { id: result.value.id };
    }),

    deleteAlgorithm: authProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const result = await deleteAlgorithmByIdForCreator({
          id: input.id,
          creatorId: ctx.user.id,
        });
        if (result.isErr()) throw result.error;
      }),

    getAlgorithm: authProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const result = await getAlgorithmByIdForCreator(input.id, ctx.user.id);
        if (result.isErr()) throw result.error;
        if (result.value == null) throw badRequest('Algorithm not found');
        return result.value;
      }),

    getAlgorithms: authProcedure.query(async ({ ctx }) => {
      const result = await getAlgorithmsByCreatorId(ctx.user.id);
      if (result.isErr()) throw result.error;
      return result.value;
    }),

    updateAlgorithmCode: authProcedure
      .input(z.object({ code: z.string().max(1024 * 1024), id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const result = await updateAlgorithmCode({
          code: input.code,
          creatorId: ctx.user.id,
          id: input.id,
        });
        if (result.isErr()) throw result.error;
      }),

    updateAlgorithmIndicators: authProcedure
      .input(
        z.object({
          id: z.string(),
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
            }),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const algorithmResult = await getAlgorithmByIdForCreator(input.id, ctx.user.id);
        if (algorithmResult.isErr()) throw algorithmResult.error;
        if (algorithmResult.value == null) throw badRequest('Algorithm not found');
        const { contextLength } = algorithmResult.value;

        const parseResult = indicatorsValidationForContextLength(input.indicators, contextLength);
        if (parseResult.isErr()) throw parseResult.error;

        const result = await updateAlgorithmIndicators({
          creatorId: ctx.user.id,
          id: input.id,
          indicators: input.indicators,
        });
        if (result.isErr()) throw result.error;
      }),
  });
}
