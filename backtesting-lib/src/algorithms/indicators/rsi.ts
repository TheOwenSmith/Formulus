import type { AlgorithmMetadata } from '@/backtesting/algorithm-metadata';
import type { Bar } from '@/backtesting/read-data';

declare module '@/backtesting/algorithm-metadata' {
  export interface AlgorithmMetadataParts {
    rsi?: {
      rsi: (number | null)[];
      avgGain: number;
      avgLoss: number;
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

  const rsiMetadata = metadata.rsi;
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

    metadata.rsi = {
      rsi,
      avgGain,
      avgLoss,
    };
    return rsi;
  } else {
    const { rsi } = rsiMetadata;

    // Compute new rsi using Wilder's smoothing
    const prevAvgGain = rsiMetadata.avgGain;
    const prevAvgLoss = rsiMetadata.avgLoss;
    const diff = bars.at(-1)![4] - bars.at(-2)![4];

    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    const avgGain = (prevAvgGain * (period - 1) + gain) / period;
    const avgLoss = (prevAvgLoss * (period - 1) + loss) / period;

    const rsiValue = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    rsi.push(rsiValue);
    rsi.shift();

    // Update metadata
    rsiMetadata.avgGain = avgGain;
    rsiMetadata.avgLoss = avgLoss;

    return rsi;
  }
}
