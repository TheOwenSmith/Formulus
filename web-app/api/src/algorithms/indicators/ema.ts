import type { Bar } from '@/backtesting/read-data';
import type { IndicatorMetadata } from './indicator-metadata';

declare module './indicator-metadata' {
  export interface IndicatorMetadataParts {
    ema?: Record<
      number,
      {
        ema: (number | null)[];
        timestamp: string;
      }
    >;
  }
}

declare module './indicator' {
  export interface IndicatorResultByIndicator {
    [x: `EMA(${number})`]: (number | null)[];
  }
}

export function computeEMA({
  bars,
  period = 12,
  metadata,
}: {
  bars: Bar[];
  period?: number;
  metadata: IndicatorMetadata;
}): (number | null)[] {
  if (period < 1) {
    throw new Error('Period must be at least 1 to compute EMA');
  }
  if (bars.length < period) {
    throw new Error(`Must have context length of at least ${period} to compute EMA(${period})`);
  }

  const k = 2 / (period + 1);

  const timestamp = bars.at(-1)![0];
  const emaMetadata = metadata.ema?.[period];
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

    if (!('ema' in metadata)) {
      metadata.ema = {};
    }
    metadata.ema![period] = { ema, timestamp };
    return ema;
  } else {
    // Compute using metadata
    const { ema } = emaMetadata;
    const lastUpdateTimestamp = emaMetadata.timestamp;

    // If the timestamp is the same as the last update, return cached result
    if (timestamp === lastUpdateTimestamp) {
      return ema;
    }

    const prevEma = ema.at(-1)!;
    const price = bars.at(-1)![4];

    // Compute new EMA using Wilder's smoothing
    const nextEma = price * k + prevEma * (1 - k);
    ema.shift();
    ema.push(nextEma);

    emaMetadata.timestamp = timestamp;
    return ema;
  }
}
