import type { Bar } from '@api/fetch/types';
import { ErrorWithCode } from '@api/utils/error-handling';
import type { IndicatorMetadata } from './indicator-metadata';

declare module './indicator-metadata' {
  export interface IndicatorMetadataParts {
    rsi?: Record<
      number,
      {
        rsi: (number | null)[];
        avgGain: number;
        avgLoss: number;
        timestamp: string;
      }
    >;
  }
}

declare module './indicator' {
  export interface IndicatorResultByIndicator {
    [x: `RSI(${number})`]: (number | null)[];
  }
}
export const rsiIndicatorResultStringified = '[x: `RSI(${number})`]: (number | null)[];';

export function computeRSI({
  bars,
  period = 14,
  metadata,
}: {
  bars: Bar[];
  period?: number;
  metadata: IndicatorMetadata;
}): (number | null)[] {
  if (period < 1) {
    throw new ErrorWithCode('Period must be at least 1 to compute RSI', 'BAD_REQUEST');
  }
  if (bars.length < period + 1) {
    throw new ErrorWithCode(
      `Must have context length of at least ${period + 1} to compute RSI(${period})`,
      'BAD_REQUEST',
    );
  }

  const timestamp = bars.at(-1)![0];
  const rsiMetadata = metadata.rsi?.[period];
  if (rsiMetadata == undefined) {
    const rsi: (number | null)[] = new Array(bars.length).fill(null);

    let totalGain = 0;
    let totalLoss = 0;
    // First, compute initial average gain/loss over first `period` changes
    for (let i = 1; i <= period; i++) {
      const diff = bars[i][4] - bars[i - 1][4];
      if (diff > 0) {
        totalGain += diff;
      } else {
        totalLoss -= diff;
      }
    }
    let avgGain = totalGain / period;
    let avgLoss = totalLoss / period;

    rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    // Apply Wilder smoothing
    for (let i = period + 1; i < bars.length; i++) {
      const diff = bars[i][4] - bars[i - 1][4];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }

    if (!('rsi' in metadata)) {
      metadata.rsi = {};
    }
    metadata.rsi![period] = { rsi, avgGain, avgLoss, timestamp };
    return rsi;
  } else {
    const { rsi } = rsiMetadata;
    const lastUpdateTimestamp = rsiMetadata.timestamp;

    // If the timestamp is the same as the last update, return cached result
    if (timestamp === lastUpdateTimestamp) {
      return rsi;
    }

    // Compute new rsi using Wilder's smoothing
    const prevAvgGain = rsiMetadata.avgGain;
    const prevAvgLoss = rsiMetadata.avgLoss;
    const diff = bars.at(-1)![4] - bars.at(-2)![4];

    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    const avgGain = (prevAvgGain * (period - 1) + gain) / period;
    const avgLoss = (prevAvgLoss * (period - 1) + loss) / period;

    let rsiValue: number;
    if (avgGain === 0 && avgLoss === 0) {
      rsiValue = 50;
    } else if (avgLoss === 0) {
      rsiValue = 100;
    } else {
      rsiValue = 100 - 100 / (1 + avgGain / avgLoss);
    }

    rsi.shift();
    rsi.push(rsiValue);

    // Update metadata
    rsiMetadata.avgGain = avgGain;
    rsiMetadata.avgLoss = avgLoss;
    rsiMetadata.timestamp = timestamp;
    return rsi;
  }
}
