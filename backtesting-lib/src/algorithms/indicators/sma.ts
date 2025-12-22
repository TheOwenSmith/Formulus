import type { AlgorithmMetadata } from '@/backtesting/algorithm-metadata';
import type { Bar } from '@/backtesting/read-data';

declare module '@/backtesting/algorithm-metadata' {
  export interface AlgorithmMetadataParts {
    sma?: {
      sum: number;
      sma: (number | null)[];
    };
  }
}

export function computeSMA({
  bars,
  period = 20,
  metadata,
}: {
  bars: Bar[];
  period?: number;
  metadata: AlgorithmMetadata;
}): (number | null)[] {
  if (bars.length < period) {
    throw new Error(`Must have context length of at least ${period} to compute ${period}-SMA`);
  }

  const smaMetadata = metadata.sma;
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

    metadata.sma = { sum, sma };
    return sma;
  } else {
    // Compute using metadata
    const { sma } = smaMetadata;
    sma.shift();

    // Update rolling sum
    smaMetadata.sum += bars.at(-1)![4];
    smaMetadata.sum -= bars[bars.length - period][4];

    const nextSma = smaMetadata.sum / period;
    sma.push(nextSma);
    return sma;
  }
}
