import { queryClient, trpcCredentials } from '@client/lib/trpc';

export async function algorithmsLoader() {
  const algorithms = await queryClient.fetchQuery(
    trpcCredentials.algorithms.getAlgorithms.queryOptions(),
  );
  return { algorithms };
}
