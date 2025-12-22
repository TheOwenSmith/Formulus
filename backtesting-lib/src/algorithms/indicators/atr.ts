import type { AlgorithmMetadata } from '@/backtesting/algorithm-metadata';
import type { Bar } from '@/backtesting/read-data';

declare module '@/backtesting/algorithm-metadata' {
  export interface AlgorithmMetadataParts {
    atr?: {
      atr: (number | null)[];
    };
  }
}

export function computeATR({
  bars,
  period = 14,
  metadata,
}: {
  bars: Bar[];
  period?: number;
  metadata: AlgorithmMetadata;
}): (number | null)[] {
  if (bars.length < period + 1) {
    throw new Error(`Must have at least ${period + 1} bars to compute ATR`);
  }

  const atrMetadata = metadata.atr;
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
          atr[i] = atrSum / period;
        }
      } else {
        // Compute subsequent ATR using Wilder's smoothing
        atr[i] = (atr[i - 1]! * (period - 1) + tr) / period;
      }
    }

    metadata.atr = { atr };
    return atr;
  } else {
    // Compute using metadata
    const { atr } = atrMetadata;

    // Calculate TR for the new bar
    const currentBar = bars.at(-1)!;
    const high = currentBar[2];
    const low = currentBar[3];
    const prevClose = bars.at(-2)![4];
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));

    // Compute new ATR using Wilder's smoothing
    const prevAtr = atr.at(-1)!;
    const nextAtr = (prevAtr * (period - 1) + tr) / period;
    atr.push(nextAtr);
    atr.shift();
    return atr;
  }
}
