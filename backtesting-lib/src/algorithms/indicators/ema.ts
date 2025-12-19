import type { Bar } from '@/backtesting/read-data';

export function computeEMA(bars: Bar[], period: number): (number | null)[] {
  if (bars.length < period) {
    throw new Error(`Must have context length of at least ${period} to compute ${period}-EMA`);
  }

  const k = 2 / (period + 1);
  const ema: (number | null)[] = Array(bars.length).fill(null);

  // Calculate the initial EMA using SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += bars[i][4];
  }
  const sma = sum / period;
  ema[period - 1] = sma;

  // Compute all remaining EMA values
  for (let i = 0; i < bars.length; i++) {
    const price = bars[i][4];
    // EMA_current = (Price_current * k) + (EMA_previous * (1 - k))
    ema.push(price * k + ema[i - 1]! * (1 - k));
  }

  return ema;
}
