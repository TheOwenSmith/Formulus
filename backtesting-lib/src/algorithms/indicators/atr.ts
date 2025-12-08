import type { Bar } from '@/backtesting/read-data';

export function computeATR(bars: Bar[], period = 14): (number | undefined)[] {
  if (bars.length < period) {
    throw new Error(`Must have at least ${period} bars to compute ATR`);
  }

  const trs: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const high = bars[i][2];
    const low = bars[i][3];
    const prevClose = i > 0 ? bars[i - 1][4] : bars[i][4];
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trs.push(tr);
  }

  const atr: (number | undefined)[] = Array(bars.length).fill(undefined);
  // Compute the initial ATR using the first period of TRs
  let atrSum = 0;
  for (let i = 0; i < period; i++) {
    atrSum += trs[i];
  }
  atr[period] = atrSum / period;

  // Compute all remaining ATR values
  for (let i = period; i < trs.length; i++) {
    atr[i] = (atr[i - 1]! * (period - 1) + trs[i]) / period;
  }
  return atr;
}
