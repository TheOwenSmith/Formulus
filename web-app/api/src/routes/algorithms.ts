import { userAlgorithmSchema } from '@api/core/algorithms/user-algorithm';
import { type TRPCContext } from '@api/lib/trpc';
import type { createUserAuthenticationProcedure } from '@api/middleware/authentication';

// /^[a-zA-Z0-9-()]+$/
// runner not allowed
// utils not allowed
export function algorithmsRouter(
  router: TRPCContext['router'],
  authProcedure: ReturnType<typeof createUserAuthenticationProcedure>,
) {
  return router({
    createAlgorithm: authProcedure.input(userAlgorithmSchema).mutation(async ({ ctx }) => {
      const { user } = ctx;
      return { user };
    }),
  });
}
