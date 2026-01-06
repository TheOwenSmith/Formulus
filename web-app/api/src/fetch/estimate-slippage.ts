import { getAggregateDataIterator } from '@api/core/backtesting/read-data';
import { trySync } from '@api/utils/error-handling';
import fs from 'fs';
import type { Ticker } from './types';

function sampleVar(xs: number[]): number | null {
  if (xs.length < 2) return null;

  const mean = xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const sumSquaredDiffs = xs.reduce((sum, x) => sum + (x - mean) ** 2, 0);
  return sumSquaredDiffs / (xs.length - 1);
}

/**
 * Microstructure Noise Estimation (Variance Ratio Method)
 *
 * Estimates one-way slippage (half-spread proxy) from 1-minute OHLC data using
 * variance comparison across different return frequencies.
 *
 * Strategy:
 *   Observed price: Y_t = X_t + ε_t
 *   - X_t = efficient price (true value)
 *   - ε_t = microstructure noise (bid/ask bounce, discreteness)
 *
 * Formulas:
 *   Return variance at frequency Δ: Var(r_Δ) ≈ σ²Δ + 2η²
 *   - σ² = efficient price variance
 *   - η² = microstructure noise variance
 *
 *   For 1-minute returns: V1 ≈ σ² + 2η²
 *   For 5-minute returns: V5 ≈ 5σ² + 2η²
 *
 *   Solving for noise: η² = (5V1 - V5) / 8
 *   One-way slippage: η ≈ S/2 (where S is the spread)
 *
 * Summary:
 *   Higher-frequency returns contain more microstructure noise. By comparing
 *   variance at 1-minute vs 5-minute intervals, we isolate the noise component
 *   and estimate the implied half-spread as a proxy for one-way execution cost.
 *
 * @param closes1m - Array of 1-minute close prices for a single trading session
 * @returns One-way slippage in basis points, or null if insufficient data
 */
function estimateOneWaySlippageBpsFrom1mCloses(closes1m: number[]): number | null {
  // Convert to log prices (stabilizes variance)
  const lp = closes1m.map((p) => Math.log(p));

  // Compute 1-minute returns
  const r1: number[] = [];
  for (let i = 1; i < lp.length; i++) {
    r1.push(lp[i] - lp[i - 1]);
  }

  // Compute 5-minute returns (non-overlapping)
  const r5: number[] = [];
  for (let i = 5; i < lp.length; i += 5) {
    r5.push(lp[i] - lp[i - 5]);
  }

  const V1 = sampleVar(r1);
  const V5 = sampleVar(r5);
  if (V1 == null || V5 == null) {
    return null;
  }

  // eta^2 in log-price units
  // eta^2 ≈ (5*V1 - V5) / 8
  let eta2 = (5 * V1 - V5) / 8;
  if (!Number.isFinite(eta2) || eta2 < 0) {
    eta2 = 0;
  }

  const eta = Math.sqrt(eta2); // ≈ one-way half-spread in log units

  // Convert log-unit cost to bps: for small moves, log-return ≈ pct-return
  const oneWayBps = eta * 10_000;
  return oneWayBps;
}

export async function estimateSlippageBps(ticker: Ticker): Promise<number | null> {
  const filename = `./data/cleaned/${ticker}_1min.csv`;
  if (!fs.existsSync(filename)) {
    throw new Error(
      `Could not estimate slippage for '${ticker}' because minute data file '${filename}' does not exist`,
    );
  }

  const getIteratorResponse = trySync(() =>
    getAggregateDataIterator({
      filename,
      parseStrictly: false,
      verboseLogging: false,
    }),
  );
  if (!getIteratorResponse.ok) throw getIteratorResponse.error;
  const iterator = getIteratorResponse.data;

  // Group closes by day
  const closesByDay: number[][] = [];
  let currentDayCloses: number[] = [];
  let prevDay: string | null = null;

  for await (const { bar } of iterator) {
    const currentDay = bar[0].slice(0, 10); // "YYYY-MM-DD"
    const close = bar[4];

    if (prevDay == null || currentDay === prevDay) {
      currentDayCloses.push(close);
    } else {
      // Push the previous session if it has enough data
      if (currentDayCloses.length >= 60) {
        closesByDay.push(currentDayCloses);
      }
      currentDayCloses = [close];
    }
    prevDay = currentDay;
  }

  // Last session
  if (currentDayCloses.length >= 60) {
    closesByDay.push(currentDayCloses);
  }

  if (closesByDay.length === 0) {
    return null;
  }

  // Estimate slippage from closes and take the average
  const slippageEstimates: number[] = [];
  for (const closes of closesByDay) {
    const estimate = estimateOneWaySlippageBpsFrom1mCloses(closes);
    if (estimate != null) {
      slippageEstimates.push(estimate);
    }
  }

  if (slippageEstimates.length === 0) {
    return null;
  }

  // Take the averge
  const averageSlippage =
    slippageEstimates.reduce((sum, val) => sum + val, 0) / slippageEstimates.length;

  return averageSlippage;
}
