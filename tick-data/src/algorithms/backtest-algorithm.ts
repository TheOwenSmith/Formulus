import { formatTable } from '@/utils/cli';
import { isMarketOpen, millisecondsToTimeString } from '@/utils/date-utils';
import { trySync } from '@/utils/errorHandling';
import { withCommas, withCommasRounded } from '@/utils/number-utils';
import fs from 'fs';
import { plot, type Plot } from 'nodeplotlib';
import path from 'path';
import { getAggregateDataIterator, type Bar } from './read-data';

export const enum Action {
  BUY,
  SELL,
  HOLD,
}
export type Algorithm = {
  name: string;
  implementation: (context: Bar[], position: number) => Action;
  contextLength: number;
};

export type Slippage = { bps: number } | { constant: number };
export function slippageToString(slippage: Slippage): string {
  return 'bps' in slippage ? slippage.bps.toString() + 'bps' : '$' + slippage.constant.toString();
}

export const MAX_POINTS_PER_PLOT = 1_000;

export async function backtestAlgorithm({
  filename,
  aggregateInMilliseconds,
  algorithm,
  slippage = { bps: 0 },
  alwaysHoldOutsideMarketHours = false,
  writeToFile,
  doPlot = false,
  timespan,
  verboseLogging = false,
}: {
  filename: string;
  aggregateInMilliseconds: number;
  algorithm: Algorithm;
  slippage?: Slippage;
  alwaysHoldOutsideMarketHours?: boolean;
  writeToFile?: string;
  doPlot?: boolean;
  timespan?: [Date, Date];
  verboseLogging?: boolean;
}) {
  if (timespan != undefined) {
    if (isNaN(timespan[0].getTime())) {
      throw new Error('Timespan is invalid: start date is not a valid date');
    }
    if (isNaN(timespan[1].getTime())) {
      throw new Error('Timespan is invalid: end date is not a valid date');
    }

    if (timespan[0] >= timespan[1]) {
      throw new Error('Timespan is invalid: start date is after end date');
    }
  }

  function calculateSlippageDelta(price: number) {
    return 'bps' in slippage ? price * (slippage.bps / 10_000) : slippage.constant;
  }

  let balance = 100;
  let position = 0;
  let trades = 0;
  function closePosition(closePrice: number) {
    // When selling (closing long), you receive the bid price (lower)
    const bidPrice = closePrice - calculateSlippageDelta(closePrice);
    balance += position * bidPrice;
    position = 0;
    trades++;
  }
  function openPosition(closePrice: number, isShort: boolean) {
    // When buying (opening long), you pay the ask price (higher)
    const askPrice = closePrice + calculateSlippageDelta(closePrice);
    if (isShort) position -= balance / askPrice;
    else position += balance / askPrice;
    balance = 0;
  }

  function portfolioValue(closePrice: number): number {
    return balance + position * closePrice;
  }

  const getIteratorResponse = trySync(() => getAggregateDataIterator(filename, verboseLogging));
  if (!getIteratorResponse.ok) {
    throw getIteratorResponse.error;
  }
  const iterator = getIteratorResponse.data;

  const previousTicks: Bar[] = [];
  let firstTick: number | null = null;
  let lastTick: number | null = null;

  let tickerYs: number[] = [];
  let strategyYs: number[] = [];
  let plotSpacing = 1;
  let lines = 0;

  // Buffer one tick ahead to determine market state efficiently
  let nextTick = await iterator.next();
  let nextTickMarketOpen = false;

  // Pre-calculate market state for the first tick
  if (!nextTick.done) {
    const nextTickEndTimestamp = new Date(
      new Date(nextTick.value[0]).getTime() + aggregateInMilliseconds,
    );
    nextTickMarketOpen = isMarketOpen(nextTickEndTimestamp);
  }

  while (!nextTick.done) {
    const currentTick = nextTick.value;
    const currentTickMarketOpen = nextTickMarketOpen;

    // Get next tick and pre-calculate its market state
    nextTick = await iterator.next();
    if (!nextTick.done) {
      const nextTickEndTimestamp = new Date(
        new Date(nextTick.value[0]).getTime() + aggregateInMilliseconds,
      );
      nextTickMarketOpen = isMarketOpen(nextTickEndTimestamp);
    } else {
      nextTickMarketOpen = false;
    }

    const startTickTimestamp = new Date(currentTick[0]);
    const endTickTimestamp = new Date(startTickTimestamp.getTime() + aggregateInMilliseconds);
    if (timespan != undefined && endTickTimestamp < timespan[0]) continue;
    if (timespan != undefined && endTickTimestamp > timespan[1]) break;

    // Skip if market is closed for this tick
    if (!currentTickMarketOpen) continue;

    if (firstTick == null) firstTick = currentTick[1];
    lastTick = currentTick[4];

    if (doPlot && lines % plotSpacing === 0) {
      tickerYs.push((currentTick[4] / firstTick!) * 100);
      strategyYs.push(portfolioValue(currentTick[4]));

      if (tickerYs.length > MAX_POINTS_PER_PLOT) {
        // Reduce the number of points in the plot by half
        const newTickerYs: number[] = [];
        const newStrategyYs: number[] = [];
        for (let i = 0; i < tickerYs.length; i += 2) {
          newTickerYs.push(tickerYs[i]);
          newStrategyYs.push(strategyYs[i]);
        }
        tickerYs = newTickerYs;
        strategyYs = newStrategyYs;
        plotSpacing *= 2;
      }
    }
    lines++;

    if (previousTicks.length < algorithm.contextLength) {
      previousTicks.push(currentTick);
    } else {
      previousTicks.shift();
      previousTicks.push(currentTick);
    }

    if (previousTicks.length < algorithm.contextLength) {
      continue;
    }

    const action =
      !nextTickMarketOpen && alwaysHoldOutsideMarketHours
        ? Action.BUY
        : algorithm.implementation(previousTicks.slice(-algorithm.contextLength), position);
    const closePrice = currentTick[4];
    if (action === Action.HOLD) {
      continue;
    }

    if (position === 0 && action === Action.BUY) {
      // buy to open
      openPosition(closePrice, false);
      continue;
    }

    if (position !== 0 && action === Action.SELL) {
      // sell to close
      closePosition(closePrice);
    }
  }

  if (position !== 0) closePosition(previousTicks.at(-1)![4]);

  const tickerReturn = firstTick && lastTick ? ((lastTick - firstTick) / firstTick) * 100 : 0;
  const tickerFinalBalance = firstTick && lastTick ? 100 * (lastTick / firstTick) : 100;

  const statistics = getBacktestStatistics({
    algorithmName: algorithm.name,
    slippage,
    alwaysHoldOutsideMarketHours,
    filename,
    aggregateInMilliseconds,
    trades,
    balance,
    tickerReturn,
    tickerFinalBalance,
  });

  if (verboseLogging) console.log(statistics);
  if (writeToFile != undefined) {
    fs.mkdirSync(path.dirname(writeToFile), { recursive: true });
    const writeFileResponse = trySync(() => fs.writeFileSync(writeToFile, statistics));
    if (!writeFileResponse.ok) throw writeFileResponse.error;
  }

  if (doPlot) {
    if (strategyYs.length === 0) {
      console.error(`No strategy data for ${algorithm.name}`);
      return;
    }

    const tickerPlot: Plot = {
      name: 'Ticker',
      x: Array.from({ length: tickerYs.length }, (_, i) => i),
      y: tickerYs,
      type: 'scatter',
    };
    const strategyPlot: Plot = {
      name: 'Strategy',
      x: Array.from({ length: tickerYs.length }, (_, i) => i),
      y: strategyYs,
      type: 'scatter',
    };

    plot([tickerPlot, strategyPlot], {
      title: algorithm.name,
      xaxis: { title: 'Time Points' },
      yaxis: { title: 'Portfolio Value ($)' },
      annotations: [
        {
          x: 0.02,
          y: 0.98,
          xref: 'paper',
          yref: 'paper',
          text: [
            `Aggregate: ${millisecondsToTimeString(aggregateInMilliseconds)}`,
            `Slippage: ${slippageToString(slippage)}`,
            `Hold after hours: ${alwaysHoldOutsideMarketHours ? 'Yes' : 'No'}`,
            `Ticker return: ${withCommasRounded(tickerReturn)}%`,
            `Trades made: ${withCommas(trades)}`,
            `Strategy return: ${withCommasRounded(balance - 100)}%`,
          ].join('<br>'),
          showarrow: false,
          bgcolor: 'rgba(255,255,255,0.8)',
          bordercolor: 'rgba(0,0,0,0.3)',
          borderwidth: 1,
        },
      ],
    });
  }
}

export function getBacktestStatistics({
  algorithmName,
  slippage = { bps: 0 },
  alwaysHoldOutsideMarketHours = false,
  filename,
  aggregateInMilliseconds,
  trades,
  balance,
  tickerReturn,
  tickerFinalBalance,
}: {
  algorithmName: string;
  slippage?: Slippage;
  alwaysHoldOutsideMarketHours?: boolean;
  filename: string;
  aggregateInMilliseconds: number;
  trades: number;
  balance: number;
  tickerReturn: number;
  tickerFinalBalance: number;
}) {
  const table: [string, string][] = [];
  table.push(['Algorithm', algorithmName]);
  table.push(['Aggregate', millisecondsToTimeString(aggregateInMilliseconds)]);
  table.push(['Slippage', slippageToString(slippage)]);
  table.push(['Hold after hours', alwaysHoldOutsideMarketHours ? 'Yes' : 'No']);
  table.push(['Ticker return', withCommasRounded(tickerReturn) + '%']);
  table.push(['Ticker final balance', '$' + withCommasRounded(tickerFinalBalance)]);
  table.push(['Trades made', withCommas(trades)]);
  table.push(['Strategy final balance', '$' + withCommasRounded(balance)]);
  table.push(['Strategy return', withCommasRounded(balance - 100) + '%']);
  table.push([
    'Strategy/ticker return',
    withCommasRounded((balance - 100) / (tickerFinalBalance - 100)) + 'x',
  ]);

  let statistics = '';
  statistics += `--- Backtest Summary (${filename}) ---` + '\n';
  statistics += formatTable(table);
  statistics += '------------------------' + '\n';
  return statistics;
}
