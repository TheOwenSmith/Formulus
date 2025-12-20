import type { AlgorithmMetadata } from '@/backtesting/algorithm-metadata';
import type { Bar } from '@/backtesting/read-data';

declare module '@/backtesting/algorithm-metadata' {
  export interface AlgorithmMetadataParts {
    rsi?: {
      rsi: number;
    };
  }
}

export function computeRSI({
  bars,
  period = 14,
  metadata,
}: {
  bars: Bar[];
  period?: number;
  metadata: AlgorithmMetadata;
}): (number | null)[] {
  if (bars.length < period + 1) {
    throw new Error(`Must have context length of at least ${period + 1} to compute RSI`);
  }

  const rsi: (number | null)[] = new Array(bars.length).fill(null);

  let gains = 0;
  let losses = 0;
  // First, compute initial average gains/losses
  for (let i = 1; i <= period; i++) {
    const diff = bars[i][4] - bars[i - 1][4];
    if (diff > 0) {
      gains += diff;
    } else {
      losses -= diff; // negative diff, so subtract to get positive loss
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // Apply Wilder smoothing
  for (let i = period + 1; i < bars.length; i++) {
    const diff = bars[i][4] - bars[i - 1][4];
    let gain = 0,
      loss = 0;
    if (diff > 0) {
      gain = diff;
    } else {
      loss = -diff;
    }
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}
