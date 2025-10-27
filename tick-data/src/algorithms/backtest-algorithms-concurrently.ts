import type { Graph, SimplePlot } from '@/lib/nodeplotlib';
import type { SelectionOption } from '@/utils/cli';
import { isMarketOpen, millisecondsToTimeString } from '@/utils/date-utils';
import { trySync } from '@/utils/errorHandling';
import { withCommas, withCommasRounded } from '@/utils/number-utils';
import fs from 'fs';
import path from 'path';
import {
  Action,
  getBacktestStatistics,
  MAX_POINTS_PER_PLOT,
  slippageToString,
  type Algorithm,
  type Slippage,
} from './backtest-algorithm';
import { getAggregateDataIterator, type Bar } from './read-data';

export type Strategy = {
  algorithm: Algorithm;
  slippage?: Slippage;
  alwaysHoldOutsideMarketHours?: boolean;
  writeToFile?: string;
  doPlot?: boolean;
};

export async function backtestAlgorithmsConcurrently({
  filename,
  aggregateInMilliseconds,
  strategies,
  timespan,
  verboseLogging = false,
}: {
  filename: string;
  aggregateInMilliseconds: number;
  strategies: Strategy[];
  timespan?: [Date, Date];
  verboseLogging?: boolean;
}): Promise<SelectionOption<Graph>[]> {
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

  function calculateSlippageDelta(index: number, price: number) {
    const { slippage } = strategies[index];
    if (slippage == undefined) return 0;

    return 'bps' in slippage ? price * (slippage.bps / 10_000) : slippage.constant;
  }

  const balances: number[] = Array(strategies.length).fill(100);
  const positions: number[] = Array(strategies.length).fill(0);
  const trades: number[] = Array(strategies.length).fill(0);
  function closePosition(index: number, closePrice: number) {
    // When selling (closing long), you receive the bid price (lower)
    const bidPrice = closePrice - calculateSlippageDelta(index, closePrice);
    balances[index] += positions[index] * bidPrice;
    positions[index] = 0;
    trades[index]++;
  }
  function openPosition(index: number, closePrice: number, isShort: boolean) {
    // When buying (opening long), you pay the ask price (higher)
    const askPrice = closePrice + calculateSlippageDelta(index, closePrice);
    if (isShort) positions[index] -= balances[index] / askPrice;
    else positions[index] += balances[index] / askPrice;
    balances[index] = 0;
  }

  function portfolioValue(index: number, closePrice: number): number {
    return balances[index] + positions[index] * closePrice;
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
  const strategyYs: number[][] = Array.from({ length: strategies.length }, () => []);
  let plotSpacing = 1;
  let lines = 0;

  let maxContextLength = 0;
  for (const { algorithm } of strategies) {
    maxContextLength = Math.max(maxContextLength, algorithm.contextLength);
  }

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

    if (lines % plotSpacing === 0) {
      tickerYs.push((currentTick[4] / firstTick!) * 100);
      for (let i = 0; i < strategies.length; i++) {
        if (strategies[i].doPlot ?? false) {
          strategyYs[i].push(portfolioValue(i, currentTick[4]));
        }
      }

      if (tickerYs.length > MAX_POINTS_PER_PLOT) {
        // Reduce the number of points in the plot by half
        const newTickerYs: number[] = [];
        for (let j = 0; j < tickerYs.length; j += 2) {
          newTickerYs.push(tickerYs[j]);
        }
        tickerYs = newTickerYs;

        for (let i = 0; i < strategies.length; i++) {
          if (strategies[i].doPlot ?? false) {
            const newStrategyYs: number[] = [];
            for (let j = 0; j < strategyYs[i].length; j += 2) {
              newStrategyYs.push(strategyYs[i][j]);
            }
            strategyYs[i] = newStrategyYs;
          }
        }
        plotSpacing *= 2;
      }
    }
    lines++;

    if (previousTicks.length < maxContextLength) {
      previousTicks.push(currentTick);
    } else {
      previousTicks.shift();
      previousTicks.push(currentTick);
    }

    if (previousTicks.length < maxContextLength) {
      continue;
    }

    for (let i = 0; i < strategies.length; i++) {
      const { algorithm, alwaysHoldOutsideMarketHours = false } = strategies[i];

      const action =
        !nextTickMarketOpen && alwaysHoldOutsideMarketHours
          ? Action.BUY
          : algorithm.implementation(previousTicks.slice(-algorithm.contextLength), positions[i]);
      const closePrice = currentTick[4];
      if (action === Action.HOLD) {
        continue;
      }

      if (positions[i] === 0 && action === Action.BUY) {
        // buy to open
        openPosition(i, closePrice, false);
        continue;
      }

      if (positions[i] !== 0 && action === Action.SELL) {
        // sell to close
        closePosition(i, closePrice);
      }
    }
  }

  const tickerReturn = firstTick && lastTick ? ((lastTick - firstTick) / firstTick) * 100 : 0;
  const tickerFinalBalance = firstTick && lastTick ? 100 * (lastTick / firstTick) : 100;

  for (let i = 0; i < strategies.length; i++) {
    if (positions[i] !== 0) closePosition(i, previousTicks.at(-1)![4]);

    const {
      algorithm,
      writeToFile,
      slippage = { bps: 0 },
      alwaysHoldOutsideMarketHours = false,
    } = strategies[i];
    const statistics = getBacktestStatistics({
      algorithmName: algorithm.name,
      slippage,
      alwaysHoldOutsideMarketHours,
      filename,
      aggregateInMilliseconds,
      trades: trades[i],
      balance: balances[i],
      tickerReturn,
      tickerFinalBalance,
    });

    if (verboseLogging) console.log(statistics);
    if (writeToFile != undefined) {
      fs.mkdirSync(path.dirname(writeToFile), { recursive: true });
      const writeFileResponse = trySync(() => fs.writeFileSync(writeToFile, statistics));
      if (!writeFileResponse.ok) throw writeFileResponse.error;
    }
  }

  const tickerXs = Array.from({ length: tickerYs.length }, (_, i) => i);
  const tickerPlot: SimplePlot = {
    name: 'Ticker',
    x: tickerXs,
    y: tickerYs,
    type: 'scatter',
  };

  const aggregateTimeString = millisecondsToTimeString(aggregateInMilliseconds);
  const graphSelectionOptions: SelectionOption<Graph>[] = [];
  for (let i = 0; i < strategies.length; i++) {
    const {
      algorithm,
      slippage = { bps: 0 },
      alwaysHoldOutsideMarketHours = false,
      doPlot = false,
    } = strategies[i];
    if (doPlot) {
      if (strategyYs[i].length === 0) {
        console.error(`No strategy data for ${algorithm.name}`);
        continue;
      }

      const strategyPlot: SimplePlot = {
        name: 'Strategy',
        x: tickerXs,
        y: strategyYs[i],
        type: 'scatter',
      };

      const strategyToTickerReturn = withCommasRounded(
        (balances[i] - 100) / (tickerFinalBalance - 100),
      );
      const description: string[] = [
        `Aggregate: ${aggregateTimeString}`,
        `Slippage: ${slippageToString(slippage)}`,
        `Hold after hours: ${alwaysHoldOutsideMarketHours ? 'Yes' : 'No'}`,
        `Ticker return: ${withCommasRounded(tickerReturn)}%`,
        `Trades made: ${withCommas(trades[i])}`,
        `Strategy return: ${withCommasRounded(balances[i] - 100)}%`,
        `Strategy/ticker return: ${strategyToTickerReturn}x`,
      ];

      graphSelectionOptions.push({
        name: [
          algorithm.name,
          slippageToString(slippage),
          ...(alwaysHoldOutsideMarketHours ? ['Hold after Hours'] : []),
          strategyToTickerReturn + 'x',
        ].join('; '),
        value: {
          tickerPlot,
          strategyPlot,
          algorithmName: algorithm.name,
          description,
        },
      });
    }
  }
  return graphSelectionOptions;
}
