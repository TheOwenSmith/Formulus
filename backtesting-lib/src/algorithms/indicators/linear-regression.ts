import type { Bar } from '@/backtesting/read-data';

export function linearRegression(bars: Bar[]): (x: number) => number {
  const n = bars.length;
  if (n === 0) {
    throw new Error('Cannot perform linear regression on empty array');
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = bars[i][4];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    // All x are the same; return a flat line
    return (_x: number) => bars[0][4] ?? 0;
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return (x: number) => slope * x + intercept;
}
