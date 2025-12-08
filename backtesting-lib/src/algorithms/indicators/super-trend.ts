import type { Bar } from '@/backtesting/read-data';
import { computeATR } from './atr';

export const enum Direction {
  UP,
  DOWN,
}

export function computeSuperTrend(
  bars: Bar[],
  period = 10,
  multiplier = 3,
): ({ superTrend: number; direction: Direction } | undefined)[] {
  if (bars.length < period + 1) {
    throw new Error(`Must have context length of at least ${period + 1} to compute SuperTrend`);
  }

  const result: ({ superTrend: number; direction: Direction } | undefined)[] = Array(
    bars.length,
  ).fill(undefined);

  // Compute ATR
  const atrs: (number | undefined)[] = computeATR(bars, period);

  for (let i = period; i < bars.length; i++) {
    const high = bars[i][2];
    const low = bars[i][3];
    const close = bars[i][4];
    const hl2 = (high + low) / 2;

    const upperBand = hl2 + multiplier * atrs[i]!;
    const lowerBand = hl2 - multiplier * atrs[i]!;

    let superTrend: number;
    let direction: Direction;

    const prev = result[i - 1];
    if (prev == null) {
      if (close <= upperBand) {
        superTrend = lowerBand;
        direction = Direction.UP;
      } else {
        superTrend = upperBand;
        direction = Direction.DOWN;
      }
    } else {
      if (prev.direction == Direction.UP) {
        superTrend = Math.max(lowerBand, prev.superTrend);
        direction = close < superTrend ? Direction.DOWN : Direction.UP;
      } else {
        superTrend = Math.min(upperBand, prev.superTrend);
        direction = close > superTrend ? Direction.UP : Direction.DOWN;
      }
    }
    result[i] = { superTrend, direction };
  }
  return result;
}
