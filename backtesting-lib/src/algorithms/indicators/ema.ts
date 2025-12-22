import type { AlgorithmMetadata } from '@/backtesting/algorithm-metadata';
import type { Bar } from '@/backtesting/read-data';

declare module '@/backtesting/algorithm-metadata' {
  export interface AlgorithmMetadataParts {
    ema?: {
      ema: (number | null)[];
    };
  }
}

export function computeEMA({
  bars,
  period = 12,
  metadata,
}: {
  bars: Bar[];
  period?: number;
  metadata: AlgorithmMetadata;
}): (number | null)[] {
  if (bars.length < period) {
    throw new Error(`Must have context length of at least ${period} to compute ${period}-EMA`);
  }

  const k = 2 / (period + 1);

  const emaMetadata = metadata.ema;
  if (emaMetadata == undefined) {
    const ema: (number | null)[] = Array(bars.length).fill(null);

    // Calculate the initial EMA using SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += bars[i][4];
    }
    ema[period - 1] = sum / period;

    // Compute all remaining EMA values using Wilder's smoothing
    for (let i = period; i < bars.length; i++) {
      const price = bars[i][4];
      // EMA_current = (Price_current * k) + (EMA_previous * (1 - k))
      ema[i] = price * k + ema[i - 1]! * (1 - k);
    }

    metadata.ema = { ema };
    return ema;
  } else {
    // Compute using metadata
    const { ema } = emaMetadata;

    const prevEma = ema.at(-1)!;
    const price = bars.at(-1)![4];

    // Compute new EMA using Wilder's smoothing
    const nextEma = (prevEma * (period - 1) + price) / period;
    ema.push(nextEma);
    ema.shift();
    return ema;
  }
}
