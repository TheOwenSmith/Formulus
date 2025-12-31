import { userAlgorithmSchema } from '@api/core/algorithms/algorithm';
import { t } from '@api/lib/trpc';

export const algorithmsRouter = t.router({
  'create-algorithm': t.procedure.input(userAlgorithmSchema).mutation(async ({ input }) => {
    return { input };
  }),
});
