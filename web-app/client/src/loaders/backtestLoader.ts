import { queryClient, trpcCredentials } from '@client/lib/trpc';
import type { BacktestAlgorithmsResult } from '@shared/worker';
import type { LoaderFunctionArgs } from 'react-router-dom';

export async function backtestLoader({ params }: LoaderFunctionArgs) {
  const publicId = params['publicId'] ?? '';

  const data = await queryClient.ensureQueryData(
    trpcCredentials.backtesting.getBacktestingResults.queryOptions(
      { publicId },
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

  data.algorithmGraphs.sort(
    (a, b) => b.descriptionMetrics.growthRate - a.descriptionMetrics.growthRate,
  );
  return { data, publicId };
}
