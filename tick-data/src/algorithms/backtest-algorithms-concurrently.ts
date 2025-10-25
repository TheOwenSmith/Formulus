import { getAggregateDataIterator, type Bar } from '@/read-data';
import { formatTable } from '@/utils/cli';
import { trySync } from '@/utils/errorHandling';
import { withCommas, withCommasRounded } from '@/utils/number-utils';
import fs from 'fs';
import { plot, type Plot } from 'nodeplotlib';
import path from 'path';
import {
  Action,
  MAX_POINTS_PER_PLOT,
  slippageToString,
  type Algorithm,
  type Slippage,
} from './backtest-algorithm';

export type Strategy = {
  algorithm: Algorithm;
  slippage?: Slippage;
  writeToFile?: string;
  doPlot?: boolean;
};

export async function backtestAlgorithmsConcurrently(
  filename: string,
  strategies: Strategy[],
  verboseLogging = false,
) {
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

  for await (const tick of iterator) {
    if (firstTick == null) firstTick = tick[1];
    lastTick = tick[4];

    if (lines % plotSpacing === 0) {
      tickerYs.push((tick[4] / firstTick!) * 100);
      for (let i = 0; i < strategies.length; i++) {
        if (strategies[i].doPlot ?? false) {
          strategyYs[i].push(portfolioValue(i, tick[4]));
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
      previousTicks.push(tick);
    } else {
      previousTicks.shift();
      previousTicks.push(tick);
    }

    if (previousTicks.length < maxContextLength) {
      continue;
    }

    for (let i = 0; i < strategies.length; i++) {
      const { algorithm } = strategies[i];
      const action = algorithm.implementation(
        previousTicks.slice(-algorithm.contextLength),
        positions[i],
      );
      const closePrice = tick[4];
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

    const { algorithm, writeToFile, slippage = { bps: 0 }, doPlot = false } = strategies[i];
    const table: [string, string][] = [];
    table.push(['Algorithm', algorithm.name]);
    table.push(['Slippage', slippageToString(slippage)]);
    table.push(['First tick open', firstTick ? '$' + firstTick.toString() : 'N/A']);
    table.push(['Last tick close', lastTick ? '$' + lastTick.toString() : 'N/A']);
    if (firstTick && lastTick) {
      table.push(['Ticker return', withCommasRounded(tickerReturn) + '%']);
      table.push(['Ticker final balance', '$' + withCommasRounded(tickerFinalBalance)]);
    }
    table.push(['Trades made', withCommas(trades[i])]);
    table.push(['Strategy final balance', '$' + withCommasRounded(balances[i])]);
    table.push(['Strategy return', withCommasRounded(balances[i] - 100) + '%']);
    if (firstTick && lastTick) {
      table.push([
        'Strategy/ticker return',
        withCommasRounded((balances[i] - 100) / (tickerFinalBalance - 100)) + 'x',
      ]);
    }

    let output = '';
    output += `--- Backtest Summary (${filename}) ---` + '\n';
    output += formatTable(table);
    output += '------------------------' + '\n';

    if (verboseLogging) console.log(output);
    if (writeToFile != undefined) {
      fs.mkdirSync(path.dirname(writeToFile), { recursive: true });
      const writeFileResponse = trySync(() => fs.appendFileSync(writeToFile, output));
      if (!writeFileResponse.ok) throw writeFileResponse.error;
    }

    if (doPlot) {
      const tickerPlot: Plot = {
        name: 'Ticker',
        x: Array.from({ length: tickerYs.length }, (_, i) => i),
        y: tickerYs,
        type: 'scatter',
      };
      const strategyPlot: Plot = {
        name: 'Strategy',
        x: Array.from({ length: tickerYs.length }, (_, i) => i),
        y: strategyYs[i],
        type: 'scatter',
      };

      const aggregateName = filename.split('_')[1] ?? 'unknown';
      if (verboseLogging) {
        console.log(
          `Plotting strategy (${i + 1}/${strategies.length}):`,
          algorithm.name + '; ' + aggregateName,
        );
      }
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
              `Aggregate: ${aggregateName}`,
              `Slippage: ${slippageToString(slippage)}`,
              `Ticker return: ${withCommasRounded(tickerReturn)}%`,
              `Trades made: ${withCommas(trades[i])}`,
              `Strategy return: ${withCommasRounded(balances[i] - 100)}%`,
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
}
