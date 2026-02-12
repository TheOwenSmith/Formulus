import type { Bar } from '@shared/api';
import { badRequest, type AppError } from '@worker/utils/error-handling';
import { err, ok, Result } from 'neverthrow';
import type { IndicatorMetadata } from './indicator-metadata';

declare module './indicator-metadata' {
  export interface IndicatorMetadataParts {
    sma?: Record<
      number,
      {
        sumWithoutLast: number;
        sma: (number | null)[];
        timestamp: string;
      }
    >;
  }
}

declare module './indicator' {
  export interface IndicatorResultByIndicator {
    [x: `SMA(${number})`]: (number | null)[];
  }
}
export const smaIndicatorResultStringified = '[x: `SMA(${number})`]: (number | null)[];';

export function computeSMA({
  bars,
  period = 20,
  metadata,
}: {
  bars: Bar[];
  period?: number;
  metadata: IndicatorMetadata;
}): Result<(number | null)[], AppError> {
  if (period < 1) {
    return err(badRequest('Period must be at least 1 to compute SMA'));
  }
  if (bars.length < period) {
    return err(
      badRequest(`Must have context length of at least ${period} to compute SMA(${period})`),
    );
  }

  const timestamp = bars.at(-1)![0];
  const smaMetadata = metadata.sma?.[period];
  if (smaMetadata == undefined) {
    const sma: (number | null)[] = Array(bars.length).fill(null);
    let sum = 0;

    for (let i = 0; i < bars.length; i++) {
      // Rolling window sum
      sum += bars[i][4];
      if (i >= period) {
        sum -= bars[i - period][4];
      }

      if (i >= period - 1) {
        sma[i] = sum / period;
      }
    }

    if (!('sma' in metadata)) {
      metadata.sma = {};
    }
    metadata.sma![period] = {
      // Remove last bar of rolling window sum
      sumWithoutLast: sum - bars[bars.length - period][4],
      sma,
      timestamp,
    };
    return ok(sma);
  } else {
    // Compute using metadata
    const { sma, sumWithoutLast } = smaMetadata;
    const lastUpdateTimestamp = smaMetadata.timestamp;

    // If the timestamp is the same as the last update, return cached result
    if (timestamp === lastUpdateTimestamp) {
      return ok(sma);
    }

    // Update rolling sum and SMA
    const sum = sumWithoutLast + bars.at(-1)![4];
    const nextSma = sum / period;
    sma.shift();
    sma.push(nextSma);

    // Update metadata for next call
    smaMetadata.sumWithoutLast = sum - bars[bars.length - period][4];
    smaMetadata.timestamp = timestamp;
    return ok(sma);
  }
}
