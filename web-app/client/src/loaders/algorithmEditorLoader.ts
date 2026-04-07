import { queryClient, trpcCredentials } from '@client/lib/trpc';
import type { LoaderFunctionArgs } from 'react-router-dom';

export async function algorithmEditorLoader({ params }: LoaderFunctionArgs) {
  const id = params['id'] ?? '';
  const algorithm = await queryClient.fetchQuery(
    trpcCredentials.algorithms.getAlgorithm.queryOptions({ id }),
  );
  return { algorithm };
}
