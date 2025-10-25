import { getAggregateDataIterator, type Bar } from '@/read-data';
import { formatTable } from '@/utils/cli';
import { trySync } from '@/utils/errorHandling';
import { withCommas, withCommasRounded } from '@/utils/number-utils';
import fs from 'fs';
import { plot, type Plot } from 'nodeplotlib';
import path from 'path';

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
  algorithm,
  slippage = { bps: 0 },
  writeToFile,
  doPlot = false,
  verboseLogging = false,
}: {
  filename: string;
  algorithm: Algorithm;
  slippage?: Slippage;
  writeToFile?: string;
  doPlot?: boolean;
  verboseLogging?: boolean;
}) {
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
  for await (const tick of iterator) {
    if (firstTick == null) firstTick = tick[1];
    lastTick = tick[4];

    if (doPlot && lines % plotSpacing === 0) {
      tickerYs.push((tick[4] / firstTick!) * 100);
      strategyYs.push(portfolioValue(tick[4]));

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
      previousTicks.push(tick);
    } else {
      previousTicks.shift();
      previousTicks.push(tick);
    }

    if (previousTicks.length < algorithm.contextLength) {
      continue;
    }

    const action = algorithm.implementation(previousTicks, position);
    const closePrice = tick[4];
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

  const table: [string, string][] = [];
  table.push(['Algorithm', algorithm.name]);
  table.push(['Slippage', slippageToString(slippage)]);
  table.push(['First tick open', firstTick ? '$' + firstTick.toString() : 'N/A']);
  table.push(['Last tick close', lastTick ? '$' + lastTick.toString() : 'N/A']);
  if (firstTick && lastTick) {
    table.push(['Ticker return', withCommasRounded(tickerReturn) + '%']);
    table.push(['Ticker final balance', '$' + withCommasRounded(tickerFinalBalance)]);
  }
  table.push(['Trades made', withCommas(trades)]);
  table.push(['Strategy final balance', '$' + withCommasRounded(balance)]);
  table.push(['Strategy return', withCommasRounded(balance - 100) + '%']);
  if (firstTick && lastTick) {
    table.push([
      'Strategy/ticker return',
      withCommasRounded((balance - 100) / (tickerFinalBalance - 100)) + 'x',
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
      y: strategyYs,
      type: 'scatter',
    };
    console.log('Plotting strategy:', algorithm.name);
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
            `Aggregate: ${filename.split('_')[1] ?? 'unknown'}`,
            `Slippage: ${slippageToString(slippage)}`,
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
