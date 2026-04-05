import { type TRPCContext } from '@api/lib/trpc';
import type { createUserAuthenticationProcedure } from '@api/middleware/authentication';
import {
  deleteAlgorithmByIdForCreator,
  getAlgorithmByIdForCreator,
  getAlgorithmsByCreatorId,
  updateAlgorithmCode,
  uploadAlgorithm,
} from '@api/repository/db-algorithm';
import { badRequest } from '@api/utils/error-handling';
import {
  userAlgorithmSchema,
  userSimpleAlgorithmSchema,
  userTopKAlgorithmSchema,
} from '@shared/worker';
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
  });
}
