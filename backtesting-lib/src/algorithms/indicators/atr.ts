import type { Bar } from '@/backtesting/read-data';

export function computeATR(bars: Bar[], period = 14): (number | null)[] {
  if (bars.length < period) {
    throw new Error(`Must have at least ${period} bars to compute ATR`);
  }

  const atr: (number | null)[] = Array(bars.length).fill(null);
  let atrSum = 0;

  for (let i = 0; i < bars.length; i++) {
    const high = bars[i][2];
    const low = bars[i][3];
    const prevClose = i > 0 ? bars[i - 1][4] : bars[i][4];
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));

    if (i < period) {
      // Accumulate initial TRs for first ATR
      atrSum += tr;
      if (i === period - 1) {
        atr[i] = atrSum / period;
      }
    } else {
      // Compute subsequent ATR using Wilder's smoothing
      atr[i] = (atr[i - 1]! * (period - 1) + tr) / period;
    }
  }
  return atr;
}
