import type { Bar } from '@api/fetch/types';
import { ErrorWithCode } from '@api/utils/error-handling';
import type { IndicatorMetadata } from './indicator-metadata';

declare module './indicator-metadata' {
  export interface IndicatorMetadataParts {
    linearRegression?: Record<
      number,
      {
        denominator: number;
        intercept: number;
        prevSumXY: number;
        slope: number;
        sumX: number;
        sumYWithoutLast: number;
        timestamp: string;
      }
    >;
  }
}

declare module './indicator' {
  export interface IndicatorResultByIndicator {
    [x: `LinearRegression(${number})`]: { slope: number; intercept: number };
  }
}
export const linearRegressionIndicatorResultStringified =
  '[x: `LinearRegression(${number})`]: { slope: number; intercept: number };';

export function computeLinearRegression({
  bars,
  period,
  metadata,
}: {
  bars: Bar[];
  period: number;
  metadata: IndicatorMetadata;
}): { slope: number; intercept: number } {
  if (period < 2) {
    throw new ErrorWithCode('Period must be at least 2 to compute LinearRegression', 'BAD_REQUEST');
  }
  const b = bars.length;
  if (b < period) {
    throw new ErrorWithCode(
      `Must have at least ${period} bars to compute LinearRegression(${period})`,
      'BAD_REQUEST',
    );
  }

  // Use the correct object for metadata
  const timestamp = bars.at(-1)![0];
  const linearRegressionMetadata = metadata.linearRegression?.[bars.length];
  if (linearRegressionMetadata == undefined) {
    // Compute sumX, sumXX, and denominator with formulas
    const sumX = (period * (period - 1)) / 2; // \sum_{x=0}^{p-1} x = p(p-1)/2
    const sumXX = (period * (period - 1) * (2 * period - 1)) / 6; // \sum_{x=0}^{p-1} x^2 = p(p-1)(2p-1)/6
    const denominator = period * sumXX - sumX * sumX;

    let sumY = 0;
    let sumXY = 0;
    for (let i = b - period; i < b; i++) {
      const x = i - (b - period);
      const y = bars[i][4];
      sumY += y;
      sumXY += x * y;
    }

    const slope = (period * sumXY - sumX * sumY) / denominator;
    const interceptUnshifted = (sumY - slope * sumX) / period;
    // Actual regression line is shifted by (b - period) to the left
    // slope*(i + (b-p)) + intercept = slope*i + (slope*(b-p) + intercept)
    const intercept = slope * (b - period) + interceptUnshifted;

    if (!('linearRegression' in metadata)) {
      metadata.linearRegression = {};
    }
    metadata.linearRegression![bars.length] = {
      denominator,
      intercept,
      prevSumXY: sumXY,
      slope,
      sumX,
      sumYWithoutLast: sumY - bars[b - period][4],
      timestamp,
    };

    // Shift the regression line by (b - period) to the left
    return { slope, intercept };
  } else {
    // If the timestamp is the same as the last update, return cached result
    const lastUpdateTimestamp = linearRegressionMetadata.timestamp;
    if (timestamp === lastUpdateTimestamp) {
      const { slope, intercept } = linearRegressionMetadata;
      return { slope, intercept };
    }

    // Compute constants
    const { sumX, denominator, sumYWithoutLast, prevSumXY } = linearRegressionMetadata;
    const y_p1 = bars.at(-1)![4];
    const sumY = sumYWithoutLast + y_p1;
    // prevSumXY = \sum_{x=0}^{p-1} x*y_{x-1}
    //           = \sum_{x=-1}^{p-2} (x+1)*y_x
    //           = \sum_{x=-1}^{p-2} x*y_x + \sum_{x=-1}^{p-2} y_x
    //           = [(\sum_{x=0}^{p-1} x*y_x) - (p-1)*y_{p-1} + (-1)*y_{-1}] +
    //             [(\sum_{x=0}^{p-1} y_x) - y_{p-1} + y_{-1}]
    //           = sumXY + sumY - p*y_{p-1}
    // \implies sumXY = prevSumXY - sumY + p*y_{p-1}
    const sumXY = prevSumXY - sumY + period * y_p1;

    // Compute slope and intercept
    const slope = (period * sumXY - sumX * sumY) / denominator;
    const interceptUnshifted = (sumY - slope * sumX) / period;
    // Apply shift
    const intercept = slope * (b - period) + interceptUnshifted;

    // Update metadata
    linearRegressionMetadata.intercept = intercept;
    linearRegressionMetadata.prevSumXY = sumXY;
    linearRegressionMetadata.slope = slope;
    linearRegressionMetadata.sumYWithoutLast = sumY - bars[b - period][4];
    linearRegressionMetadata.timestamp = timestamp;

    return { slope, intercept };
  }
}
