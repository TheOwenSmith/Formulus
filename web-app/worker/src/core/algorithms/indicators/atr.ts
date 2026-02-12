import type { Bar } from '@shared/api';
import { badRequest, type AppError } from '@worker/utils/error-handling';
import { err, ok, type Result } from 'neverthrow';
import type { IndicatorMetadata } from './indicator-metadata';

declare module './indicator-metadata' {
  export interface IndicatorMetadataParts {
    atr?: Record<
      number,
      {
        atr: (number | null)[];
        timestamp: string;
      }
    >;
  }
}

declare module './indicator' {
  export interface IndicatorResultByIndicator {
    [x: `ATR(${number})`]: (number | null)[];
  }
}
export const atrIndicatorResultStringified = '[x: `ATR(${number})`]: (number | null)[];';

export function computeATR({
  bars,
  period = 14,
  metadata,
}: {
  bars: Bar[];
  period?: number;
  metadata: IndicatorMetadata;
}): Result<(number | null)[], AppError> {
  if (period < 1) {
    return err(badRequest('Period must be at least 1 to compute ATR'));
  }
  if (bars.length < period + 1) {
    return err(badRequest(`Must have at least ${period + 1} bars to compute ATR(${period})`));
  }

  const timestamp = bars.at(-1)![0];
  const atrMetadata = metadata.atr?.[period];
  if (atrMetadata == undefined) {
    const atr: (number | null)[] = Array(bars.length).fill(null);
    let atrSum = 0;

    for (let i = 1; i < bars.length; i++) {
      const high = bars[i][2];
      const low = bars[i][3];
      const prevClose = bars[i - 1][4];
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));

      if (i <= period) {
        // Accumulate initial TRs for first ATR
        atrSum += tr;
        if (i === period) {
          atr[period] = atrSum / period;
        }
      } else {
        // Compute subsequent ATR using Wilder's smoothing
        atr[i] = (atr[i - 1]! * (period - 1) + tr) / period;
      }
    }

    if (!('atr' in metadata)) {
      metadata.atr = {};
    }
    metadata.atr![period] = { atr, timestamp };
    return ok(atr);
  } else {
    // Compute using metadata
    const { atr } = atrMetadata;
    const lastUpdateTimestamp = atrMetadata.timestamp;

    // If the timestamp is the same as the last update, return cached result
    if (timestamp === lastUpdateTimestamp) {
      return ok(atr);
    }

    // Calculate TR for the new bar
    const currentBar = bars.at(-1)!;
    const high = currentBar[2];
    const low = currentBar[3];
    const prevClose = bars.at(-2)![4];
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));

    // Compute new ATR using Wilder's smoothing
    const prevAtr = atr.at(-1)!;
    const nextAtr = (prevAtr * (period - 1) + tr) / period;
    atr.shift();
    atr.push(nextAtr);

    atrMetadata.timestamp = timestamp;
    return ok(atr);
  }
}
