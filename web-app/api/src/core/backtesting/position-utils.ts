import { Action } from '@api/core/algorithms/algorithm';
import type { Ticker } from '@api/fetch/types';
import { ErrorWithCode } from '@api/utils/error-handling';
import type { AlgorithmData } from './backtest-algorithms-concurrently';

// See docs/Phoenix_Trader_Position_Management_System.pdf
export function updatePosition({
  actions,
  algorithmData,
  algorithmMaxHoldingProportion,
  algorithmTickers,
  priceByTicker,
  slippageByTicker,
  ticks,
}: {
  actions: Record<Ticker, Action>;
  algorithmData: AlgorithmData;
  algorithmMaxHoldingProportion: number;
  algorithmTickers: Ticker[];
  priceByTicker: Record<Ticker, number>;
  slippageByTicker: Record<Ticker, number>;
  ticks: number;
}) {
  // Initialize sets
  const h: Ticker[] = [];
  const th: Ticker[] = [];
  const b: Ticker[] = [];

  for (const ticker of algorithmTickers) {
    if (!(ticker in actions)) {
      throw new ErrorWithCode(
        `No action specified for ticker '${ticker}' in actions record`,
        'BAD_REQUEST',
      );
    }

    const has = algorithmData.positions[ticker] > 0;
    const action = actions[ticker];

    if (has && action === Action.SELL) {
      th.push(ticker);
    } else if (has) {
      h.push(ticker);
    } else if (action === Action.BUY) {
      b.push(ticker);
    }
  }

  // Compute k
  const k = computeK({
    algorithmPositions: algorithmData.positions,
    b,
    c: algorithmData.balance,
    h,
    priceByTicker,
    r: algorithmMaxHoldingProportion,
    slippageByTicker,
    th,
  });

  // Sell
  for (const ticker of th) {
    const slippage = slippageByTicker[ticker] / 10_000;

    closePosition({
      algorithmData,
      pricePerShare: priceByTicker[ticker],
      slippage,
      ticker,
      ticks,
    });
  }

  // Adjust holding
  for (const ticker of h) {
    const sharesOwned = algorithmData.positions[ticker];
    const positionSize = priceByTicker[ticker] * sharesOwned;
    const deltaPositionSize = k - positionSize;
    const slippage = slippageByTicker[ticker] / 10_000;

    // Update balance
    if (deltaPositionSize > 0) {
      // Buy to correct position
      const slippageFactor = 1 + slippage;
      const cost = slippageFactor * deltaPositionSize;
      algorithmData.balance -= cost;
      algorithmData.entracePriceExitPriceByTickerPosition[ticker][0] += cost;
    } else if (deltaPositionSize < 0) {
      // Sell to correct position
      const slippageFactor = 1 - slippage;
      const profit = slippageFactor * -deltaPositionSize;
      algorithmData.balance += profit;
      algorithmData.entracePriceExitPriceByTickerPosition[ticker][1] += profit;
    } else {
      continue;
    }

    algorithmData.positions[ticker] += deltaPositionSize / priceByTicker[ticker];
    algorithmData.trades++;
  }

  // Buy
  for (const ticker of b) {
    const slippage = slippageByTicker[ticker] / 10_000;
    algorithmData.positions[ticker] = k / priceByTicker[ticker];

    const cost = (1 + slippage) * k;
    algorithmData.balance -= cost;
    algorithmData.entracePriceExitPriceByTickerPosition[ticker][0] += cost;
    algorithmData.entraceTimeByTickerPosition[ticker] = ticks;
    algorithmData.trades++;
  }
}

const TOLERANCE = 1e-8;
function computeK({
  algorithmPositions,
  b,
  c,
  h,
  priceByTicker,
  r,
  slippageByTicker,
  th,
}: {
  algorithmPositions: Record<Ticker, number>;
  b: Ticker[];
  c: number;
  h: Ticker[];
  priceByTicker: Record<Ticker, number>;
  r: number;
  slippageByTicker: Record<Ticker, number>;
  th: Ticker[];
}): number {
  const sortedPositionSlippageTuple: [number, number][] = [];

  // Compute constants beta and phi
  let beta = c;
  for (const ticker of h) {
    const sharesOwned = algorithmPositions[ticker];
    const positionSize = priceByTicker[ticker] * sharesOwned;
    const slippage = slippageByTicker[ticker] / 10_000;
    beta += positionSize;

    sortedPositionSlippageTuple.push([positionSize, slippage]);
  }

  for (const ticker of th) {
    const sharesOwned = algorithmPositions[ticker];
    const positionSize = priceByTicker[ticker] * sharesOwned;
    const slippage = slippageByTicker[ticker] / 10_000;
    beta += positionSize - slippage * positionSize;
  }

  let phi = (h.length + b.length) / r; // N / r
  for (const ticker of b) {
    const slippage = slippageByTicker[ticker] / 10_000;
    phi += slippage;
  }

  const n = h.length;
  if (n === 0) {
    return beta / phi;
  }

  // Sort by price
  sortedPositionSlippageTuple.sort((a, b) => a[0] - b[0]);

  // Compute s_l and s_r
  const s_l: number[] = Array(n).fill(0); // s_l[j] = sum_{i=0}^{j} slippage_i
  const s_r: number[] = Array(n).fill(0); // s_r[j] = sum_{i=j}^{n-1} slippage_i
  for (let i = 0; i < n; i++) {
    const slippage = sortedPositionSlippageTuple[i][1];
    s_l[i] = (s_l[i - 1] ?? 0) + slippage;
  }
  for (let i = n - 1; i >= 0; i--) {
    const slippage = sortedPositionSlippageTuple[i][1];
    s_r[i] = (s_r[i + 1] ?? 0) + slippage;
  }

  // Compute sigma_pl and sigma_pr
  const sigma_pl: number[] = Array(n - 1).fill(0); // sigma_pl[j] = sum_{i=0}^{j} slippage_i * p_i
  const sigma_pr: number[] = Array(n - 1).fill(0); // sigma_pr[j] = sum_{i=j}^{n-1} slippage_i * p_i
  for (let i = 0; i < n; i++) {
    const [position, slippage] = sortedPositionSlippageTuple[i];
    const delta = position * slippage;
    sigma_pl[i] = (sigma_pl[i - 1] ?? 0) + delta;
  }
  for (let i = n - 1; i >= 0; i--) {
    const [position, slippage] = sortedPositionSlippageTuple[i];
    const delta = position * slippage;
    sigma_pr[i] = (sigma_pr[i + 1] ?? 0) + delta;
  }

  for (let i = 0; i + 1 < n; i++) {
    // Assuming p_i<=k<p_{i+1}
    const potentialK = (beta + sigma_pl[i] - sigma_pr[i + 1]) / (phi + s_l[i] - s_r[i + 1]);
    if (
      sortedPositionSlippageTuple[i][0] - TOLERANCE <= potentialK &&
      potentialK < sortedPositionSlippageTuple[i + 1][0] + TOLERANCE
    ) {
      return potentialK;
    }
  }

  // Assuming k<p_0
  const potentialKLeftEdge = (beta - sigma_pr[0]) / (phi - s_r[0]);
  if (potentialKLeftEdge < sortedPositionSlippageTuple[0][0] + TOLERANCE) {
    return potentialKLeftEdge;
  }

  // Assume k>=p{i+1}
  const potentialKRightEdge = (beta + sigma_pl.at(-1)!) / (phi + s_l.at(-1)!);
  if (potentialKRightEdge >= sortedPositionSlippageTuple.at(-1)![0] - TOLERANCE) {
    return potentialKRightEdge;
  }

  throw new ErrorWithCode('k not found', 'INTERNAL_SERVER_ERROR');
}

export function getPortfolioValue({
  priceByTicker,
  algorithmData,
}: {
  priceByTicker: Record<Ticker, number>;
  algorithmData: AlgorithmData;
}): number {
  let value = algorithmData.balance;
  for (const ticker in algorithmData.positions) {
    const sharesOwned = algorithmData.positions[ticker];
    value += priceByTicker[ticker] * sharesOwned;
  }
  return value;
}

export function closeAllPositions({
  algorithmData,
  priceByTicker,
  slippageByTicker,
  ticks,
}: {
  algorithmData: AlgorithmData;
  priceByTicker: Record<Ticker, number>;
  slippageByTicker: Record<Ticker, number>;
  ticks: number;
}) {
  for (const ticker in algorithmData.positions) {
    const slippage = slippageByTicker[ticker] / 10_000;

    closePosition({
      algorithmData,
      pricePerShare: priceByTicker[ticker],
      slippage,
      ticker,
      ticks,
    });
  }
}

function closePosition({
  algorithmData,
  pricePerShare,
  slippage,
  ticker,
  ticks,
}: {
  algorithmData: AlgorithmData;
  pricePerShare: number;
  slippage: number;
  ticker: Ticker;
  ticks: number;
}) {
  const sharesOwned = algorithmData.positions[ticker];
  if (sharesOwned === 0) return;

  const positionSize = pricePerShare * sharesOwned;
  const sellingProfit = (1 - slippage) * positionSize;

  // Update balance and position
  algorithmData.balance += sellingProfit;
  algorithmData.positions[ticker] = 0;
  algorithmData.entracePriceExitPriceByTickerPosition[ticker][1] += sellingProfit;
  const [entryPrice, exitPrice] = algorithmData.entracePriceExitPriceByTickerPosition[ticker];

  // = (average exit price per share - average entrace price per share) / average entrace price per share
  const profitLossPercentage = (exitPrice - entryPrice) / entryPrice;
  algorithmData.entracePriceExitPriceByTickerPosition[ticker] = [0, 0];

  // Update W/L and P/L related variables
  if (profitLossPercentage > 0) {
    algorithmData.winsLosses[0]++;
    algorithmData.cumulativeProfitLoss[0] += profitLossPercentage;
  } else if (profitLossPercentage < 0) {
    algorithmData.winsLosses[1]++;
    algorithmData.cumulativeProfitLoss[1] += -profitLossPercentage;
  }

  // Update holding time, positions closed, and trades
  algorithmData.cumulativeHoldingTime += ticks - algorithmData.entraceTimeByTickerPosition[ticker];
  algorithmData.positionsClosed++;
  algorithmData.trades++;
}
