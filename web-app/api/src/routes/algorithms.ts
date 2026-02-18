import { type TRPCContext } from '@api/lib/trpc';
import type { createUserAuthenticationProcedure } from '@api/middleware/authentication';
import { uploadAlgorithm } from '@api/repository/db-algorithm';
import { userAlgorithmSchema } from '@shared/worker';

export function algorithmsRouter(
  router: TRPCContext['router'],
  authProcedure: ReturnType<typeof createUserAuthenticationProcedure>,
) {
  return router({
    createAlgorithm: authProcedure.input(userAlgorithmSchema).mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const result = await uploadAlgorithm({ algorithm: input, creatorId: user.id });
      if (result.isErr()) {
        throw result.error;
      }
      return { id: result.value.id };
    }),
  });
}
