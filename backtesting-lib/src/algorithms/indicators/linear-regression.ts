import type { AlgorithmMetadata } from '@/backtesting/algorithm-metadata';
import type { Bar } from '@/backtesting/read-data';

declare module '@/backtesting/algorithm-metadata' {
  export interface AlgorithmMetadataParts {
    linearRegression?: {
      sumX: number;
      sumYWithoutLast: number;
      sumXYWithoutLast: number;
      denominator: number;
    };
  }
}

export function linearRegression({
  bars,
  metadata,
}: {
  bars: Bar[];
  metadata: AlgorithmMetadata;
}): (x: number) => number {
  const n = bars.length;
  if (n < 2) {
    throw new Error('Must have at least 2 bars to perform linear regression');
  }

  // Use the correct object for metadata
  const linearRegressionMetadata = metadata.linearRegression;
  if (linearRegressionMetadata == undefined) {
    // Compute sumX, sumXX, and denominator with formulas
    const sumX = (n * (n - 1)) / 2; // \sum_{x=0}^{n-1} x = (n-1)n/2
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6; // \sum_{x=0}^{n-1} x^2 = (n-1)n(2n-1)/6
    const denominator = n * sumXX - sumX * sumX;

    let sumY = 0;
    let sumXY = 0;
    for (let i = 0; i < n; i++) {
      const x = i;
      const y = bars[i][4];
      sumY += y;
      sumXY += x * y;
    }

    metadata.linearRegression = {
      sumX,
      sumYWithoutLast: sumY - bars[0][4],
      // \sum_{i=0}^{n-1} i*y_i = \sum_{i=0}^{n-2} (i+1)*y_{i+1}
      // \implies sumXY = sumXYWithoutLast + sumY
      // \implies sumXYWithoutLast = sumXY - sumY
      sumXYWithoutLast: sumXY - sumY,
      denominator,
    };

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    return (x: number) => slope * x + intercept;
  } else {
    const { sumX, denominator, sumYWithoutLast, sumXYWithoutLast } = linearRegressionMetadata;

    // Incremental update assumes only one new bar is added
    const x = n - 1;
    const y = bars.at(-1)![4];
    const sumY = sumYWithoutLast + y;
    const sumXY = sumXYWithoutLast + x * y;

    // Update metadata
    linearRegressionMetadata.sumYWithoutLast = sumY - bars[0][4];
    linearRegressionMetadata.sumXYWithoutLast = sumXY - sumY;

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    return (x: number) => slope * x + intercept;
  }
}
