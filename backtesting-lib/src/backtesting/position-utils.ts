import { Action } from '@/algorithms/create-simple-algorithm';
import type { Ticker } from '@/fetch/fetch';

// See docs/Phoenix_Trader_Position_Management_System.pdf
export function updatePosition({
  actions,
  algorithmChangeInBalanceByTickerPosition,
  algorithmCumulativeProfitLoss,
  algorithmIndex,
  algorithmMaxHoldingProportion,
  algorithmPositions,
  algorithmTickers,
  algorithmWinsLosses,
  balancesByAlgorithm,
  positionsClosedByAlgorithm,
  priceByTicker,
  tickerDataByTicker,
  tradesByAlgorithm,
}: {
  actions: Record<Ticker, Action>;
  algorithmChangeInBalanceByTickerPosition: Record<Ticker, number>;
  algorithmCumulativeProfitLoss: [number, number];
  algorithmIndex: number;
  algorithmMaxHoldingProportion: number;
  algorithmPositions: Record<Ticker, number>;
  algorithmTickers: Ticker[];
  algorithmWinsLosses: [number, number];
  balancesByAlgorithm: number[];
  positionsClosedByAlgorithm: number[];
  priceByTicker: Record<Ticker, number>;
  tickerDataByTicker: Record<Ticker, [filename: string, slippage: number]>;
  tradesByAlgorithm: number[];
}) {
  // Initialize sets
  const h: Ticker[] = [];
  const th: Ticker[] = [];
  const b: Ticker[] = [];

  for (const ticker of algorithmTickers) {
    if (!(ticker in actions)) {
      throw new Error(`No action specified for ticker '${ticker}' in actions record`);
    }

    const has = algorithmPositions[ticker] > 0;
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
    algorithmPositions,
    b,
    c: balancesByAlgorithm[algorithmIndex],
    h,
    priceByTicker,
    r: algorithmMaxHoldingProportion,
    th,
    tickerDataByTicker,
  });

  // Sell
  let changeInBalance = 0;
  for (const ticker of th) {
    const sharesOwned = algorithmPositions[ticker];
    const positionSize = priceByTicker[ticker] * sharesOwned;
    const slippage = tickerDataByTicker[ticker][1] / 10_000;
    const sellingProfit = (1 - slippage) * positionSize;
    changeInBalance += sellingProfit;

    closePosition({
      algorithmChangeInBalanceByTickerPosition,
      algorithmCumulativeProfitLoss,
      algorithmIndex,
      algorithmPositions,
      algorithmWinsLosses,
      positionsClosedByAlgorithm,
      sellingProfit,
      ticker,
    });
  }

  // Adjust holding
  for (const ticker of h) {
    const sharesOwned = algorithmPositions[ticker];
    const positionSize = priceByTicker[ticker] * sharesOwned;
    const deltaPositionSize = k - positionSize;
    const slippage = tickerDataByTicker[ticker][1] / 10_000;
    const slippageFactor = deltaPositionSize < 0 ? 1 - slippage : 1 + slippage;

    // Update balance
    const deltaChangeInBalance = slippageFactor * -deltaPositionSize;
    changeInBalance += deltaChangeInBalance;
    algorithmChangeInBalanceByTickerPosition[ticker] += deltaChangeInBalance;
    algorithmPositions[ticker] += deltaPositionSize / priceByTicker[ticker];
  }

  // Buy
  for (const ticker of b) {
    const slippage = tickerDataByTicker[ticker][1] / 10_000;
    algorithmPositions[ticker] = k / priceByTicker[ticker];

    const cost = (1 + slippage) * k;
    changeInBalance -= cost;
    algorithmChangeInBalanceByTickerPosition[ticker] -= cost;
  }

  // Update trades and balances
  tradesByAlgorithm[algorithmIndex] += th.length + h.length + b.length;
  balancesByAlgorithm[algorithmIndex] += changeInBalance;
}

const TOLERANCE = 1e-8;
function computeK({
  algorithmPositions,
  b,
  c,
  h,
  priceByTicker,
  r,
  th,
  tickerDataByTicker,
}: {
  algorithmPositions: Record<Ticker, number>;
  b: Ticker[];
  c: number;
  h: Ticker[];
  priceByTicker: Record<Ticker, number>;
  r: number;
  th: Ticker[];
  tickerDataByTicker: Record<Ticker, [filename: string, slippage: number]>;
}): number {
  const sortedPositionSlippageTuple: [number, number][] = [];

  // Compute constants beta and phi
  let beta = c;
  for (const ticker of h) {
    const sharesOwned = algorithmPositions[ticker];
    const positionSize = priceByTicker[ticker] * sharesOwned;
    const slippage = tickerDataByTicker[ticker][1] / 10_000;
    beta += positionSize;

    sortedPositionSlippageTuple.push([positionSize, slippage]);
  }

  for (const ticker of th) {
    const sharesOwned = algorithmPositions[ticker];
    const positionSize = priceByTicker[ticker] * sharesOwned;
    const slippage = tickerDataByTicker[ticker][1] / 10_000;
    beta += positionSize - slippage * positionSize;
  }

  let phi = (h.length + b.length) / r;
  for (const ticker of b) {
    const slippage = tickerDataByTicker[ticker][1] / 10_000;
    phi += slippage;
  }

  if (h.length === 0) {
    return beta / phi;
  }

  // Sort by price
  sortedPositionSlippageTuple.sort((a, b) => a[0] - b[0]);

  // Compute s_l and s_r
  const s_l: number[] = []; // s_l[j] = sum_{i=0}^{j} p_i
  const s_r: number[] = []; // s_r[j] = sum_{i=j}^{n} p_i
  for (let i = 0; i < sortedPositionSlippageTuple.length; i++) {
    const slippage = sortedPositionSlippageTuple[i][1];
    s_l.push((s_l.at(-1) ?? 0) + slippage);
  }
  for (let i = sortedPositionSlippageTuple.length - 1; i >= 0; i--) {
    const slippage = sortedPositionSlippageTuple[i][1];
    s_r.push((s_r.at(-1) ?? 0) + slippage);
  }

  // Compute sigma_pl and sigma_pr
  const sigma_pl: number[] = []; // sigma_pl[j] = sum_{i=0}^{j} slippage_i * p_i
  const sigma_pr: number[] = []; // sigma_pr[j] = sum_{i=j}^{n} slippage_i * p_i
  for (let i = 0; i < sortedPositionSlippageTuple.length; i++) {
    const [position, slippage] = sortedPositionSlippageTuple[i];
    const delta = position * slippage;
    sigma_pl.push((sigma_pl.at(-1) ?? 0) + delta);
  }
  for (let i = sortedPositionSlippageTuple.length - 1; i >= 0; i--) {
    const [position, slippage] = sortedPositionSlippageTuple[i];
    const delta = position * slippage;
    sigma_pr.push((sigma_pr.at(-1) ?? 0) + delta);
  }

  for (let i = 0; i + 1 < sortedPositionSlippageTuple.length; i++) {
    // Assuming p_i<=k<p_{i+1}
    const potentialK = (beta + sigma_pl[i] - sigma_pr[i + 1]) / (phi + s_l[i] - s_r[i + 1]);
    if (
      sortedPositionSlippageTuple[i][0] <= potentialK &&
      potentialK < sortedPositionSlippageTuple[i + 1][0]
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

  throw new Error('k not found');
}

export function getPortfolioValue({
  algorithmPositions,
  priceByTicker,
  balance,
}: {
  algorithmPositions: Record<Ticker, number>;
  priceByTicker: Record<Ticker, number>;
  balance: number;
}): number {
  let value = balance;
  for (const ticker in algorithmPositions) {
    value += algorithmPositions[ticker] * priceByTicker[ticker];
  }
  return value;
}

export function closeAllPositions({
  algorithmChangeInBalanceByTickerPosition,
  algorithmCumulativeProfitLoss,
  algorithmIndex,
  algorithmPositions,
  algorithmWinsLosses,
  balancesByAlgorithm,
  positionsClosedByAlgorithm,
  priceByTicker,
  tickerDataByTicker,
  tradesByAlgorithm,
}: {
  algorithmChangeInBalanceByTickerPosition: Record<Ticker, number>;
  algorithmCumulativeProfitLoss: [number, number];
  algorithmIndex: number;
  algorithmPositions: Record<Ticker, number>;
  algorithmWinsLosses: [number, number];
  balancesByAlgorithm: number[];
  positionsClosedByAlgorithm: number[];
  priceByTicker: Record<Ticker, number>;
  tickerDataByTicker: Record<Ticker, [filename: string, slippage: number]>;
  tradesByAlgorithm: number[];
}) {
  let changeInBalance = 0;
  for (const ticker in algorithmPositions) {
    const sharesOwned = algorithmPositions[ticker];
    const positionSize = priceByTicker[ticker] * sharesOwned;
    const slippage = tickerDataByTicker[ticker][1] / 10_000;
    const sellingProfit = (1 - slippage) * positionSize;
    changeInBalance += sellingProfit;

    closePosition({
      algorithmChangeInBalanceByTickerPosition,
      algorithmCumulativeProfitLoss,
      algorithmIndex,
      algorithmPositions,
      algorithmWinsLosses,
      positionsClosedByAlgorithm,
      sellingProfit,
      ticker,
    });
  }
  tradesByAlgorithm[algorithmIndex] += Object.keys(algorithmPositions).length;
  balancesByAlgorithm[algorithmIndex] += changeInBalance;
}

function closePosition({
  algorithmChangeInBalanceByTickerPosition,
  algorithmCumulativeProfitLoss,
  algorithmIndex,
  algorithmPositions,
  algorithmWinsLosses,
  positionsClosedByAlgorithm,
  sellingProfit,
  ticker,
}: {
  algorithmChangeInBalanceByTickerPosition: Record<Ticker, number>;
  algorithmCumulativeProfitLoss: [number, number];
  algorithmIndex: number;
  algorithmPositions: Record<Ticker, number>;
  algorithmWinsLosses: [number, number];
  positionsClosedByAlgorithm: number[];
  sellingProfit: number;
  ticker: Ticker;
}) {
  // Update balance
  const positionProfit = algorithmChangeInBalanceByTickerPosition[ticker] + sellingProfit;
  algorithmPositions[ticker] = 0;
  algorithmChangeInBalanceByTickerPosition[ticker] = 0;

  // Update W/L and P/L related variables
  if (positionProfit > 0) {
    algorithmWinsLosses[0]++;
    algorithmCumulativeProfitLoss[0] += positionProfit;
  } else if (positionProfit < 0) {
    algorithmWinsLosses[1]++;
    algorithmCumulativeProfitLoss[1] += -positionProfit;
  }
  positionsClosedByAlgorithm[algorithmIndex]++;
}
