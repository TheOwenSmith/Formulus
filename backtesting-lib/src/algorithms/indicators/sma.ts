import type { Bar } from '@/backtesting/read-data';

export function computeSMA(bars: Bar[], period: number): (number | undefined)[] {
  if (bars.length < period) {
    throw new Error(`Must have context length of at least ${period} to compute ${period}-SMA`);
  }

  const result: (number | undefined)[] = Array(bars.length).fill(undefined);
  let sum = 0;

  for (let i = 0; i < bars.length; i++) {
    // Rolling window sum
    sum += bars[i][4];
    if (i >= period) {
      sum -= bars[i - period][4];
    }

    if (i >= period - 1) {
      result[i] = sum / period;
    }
  }
  return result;
}
