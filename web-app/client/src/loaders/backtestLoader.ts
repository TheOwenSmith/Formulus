import { queryClient, trpcCredentials } from '@client/lib/trpc';
import type { BacktestAlgorithmsResult } from '@shared/worker';
import type { LoaderFunctionArgs } from 'react-router-dom';

export async function backtestLoader({ params }: LoaderFunctionArgs) {
  const data = await queryClient.ensureQueryData(
    trpcCredentials.backtesting.getBacktestingResults.queryOptions(
      {
        publicId: params['publicId'] ?? '',
      },
      {
        select: (data: BacktestAlgorithmsResult | null) =>
          data != null
            ? {
                ...data,
                algorithmGraphs: data.algorithmGraphs.toSorted(
                  (a, b) => b.descriptionMetrics.growthRate - a.descriptionMetrics.growthRate,
                ),
              }
            : null,
      },
    ),
  );
  if (data == null) {
    throw new Error('Backtesting results not found');
  }

  // sort algorithms by performance
  data.algorithmGraphs.sort(
    (a, b) => b.descriptionMetrics.growthRate - a.descriptionMetrics.growthRate,
  );
  return { data };
}
