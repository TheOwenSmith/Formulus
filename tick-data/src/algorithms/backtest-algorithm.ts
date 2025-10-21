import { getAggregateDataIterator, type Bar } from '@/read-data';
import { formatTable } from '@/utils/cli';
import { trySync } from '@/utils/errorHandling';
import { withCommasRounded } from '@/utils/number-utils';
import fs from 'fs';
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
function slippageToString(slippage: Slippage): string {
  return 'bps' in slippage ? slippage.bps.toString() + 'bps' : '$' + slippage.constant.toString();
}

export type Strategy = {
  algorithm: Algorithm;
  slippage?: Slippage;
  writeToFile?: string;
};

export async function backtestAlgorithm({
  filename,
  algorithm,
  slippage = { bps: 0 },
  writeToFile,
  verboseLogging = false,
}: {
  filename: string;
  algorithm: Algorithm;
  slippage?: Slippage;
  writeToFile?: string;
  verboseLogging?: boolean;
}) {
  function calculateSlippageDelta(price: number) {
    return 'bps' in slippage ? price * (slippage.bps / 10_000) : slippage.constant;
  }

  let balance = 100;
  let position = 0;
  function closePosition(closePrice: number) {
    // When selling (closing long), you receive the bid price (lower)
    const bidPrice = closePrice - calculateSlippageDelta(closePrice);
    balance += position * bidPrice;
    position = 0;
  }
  function openPosition(closePrice: number, isShort: boolean) {
    // When buying (opening long), you pay the ask price (higher)
    const askPrice = closePrice + calculateSlippageDelta(closePrice);
    if (isShort) position -= balance / askPrice;
    else position += balance / askPrice;
    balance = 0;
  }

  const getIteratorResponse = trySync(() => getAggregateDataIterator(filename, verboseLogging));
  if (!getIteratorResponse.ok) {
    throw getIteratorResponse.error;
  }
  const iterator = getIteratorResponse.data;

  const previousTicks: Bar[] = [];
  let firstTick: number | null = null;
  let lastTick: number | null = null;
  for await (const tick of iterator) {
    if (firstTick == null) firstTick = tick[1];
    lastTick = tick[4];

    if (previousTicks.length < algorithm.contextLength) {
      previousTicks.push(tick);
      if (previousTicks.length < algorithm.contextLength) continue;
    } else {
      previousTicks.shift();
      previousTicks.push(tick);
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
  table.push(['Final balance', '$' + withCommasRounded(balance)]);
  table.push(['Return', withCommasRounded(balance - 100) + '%']);
  if (firstTick && lastTick) {
    table.push(['Strategy/ticker return', withCommasRounded(balance / tickerFinalBalance) + 'x']);
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
}

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
  function closePosition(index: number, closePrice: number) {
    // When selling (closing long), you receive the bid price (lower)
    const bidPrice = closePrice - calculateSlippageDelta(index, closePrice);
    balances[index] += positions[index] * bidPrice;
    positions[index] = 0;
  }
  function openPosition(index: number, closePrice: number, isShort: boolean) {
    // When buying (opening long), you pay the ask price (higher)
    const askPrice = closePrice + calculateSlippageDelta(index, closePrice);
    if (isShort) positions[index] -= balances[index] / askPrice;
    else positions[index] += balances[index] / askPrice;
    balances[index] = 0;
  }

  const getIteratorResponse = trySync(() => getAggregateDataIterator(filename, verboseLogging));
  if (!getIteratorResponse.ok) {
    throw getIteratorResponse.error;
  }
  const iterator = getIteratorResponse.data;

  const previousTicks: Bar[] = [];
  let firstTick: number | null = null;
  let lastTick: number | null = null;
  for await (const tick of iterator) {
    if (firstTick == null) firstTick = tick[1];
    lastTick = tick[4];

    for (let i = 0; i < strategies.length; i++) {
      const { algorithm } = strategies[i];
      if (previousTicks.length < algorithm.contextLength) {
        previousTicks.push(tick);
        if (previousTicks.length < algorithm.contextLength) continue;
      } else {
        previousTicks.shift();
        previousTicks.push(tick);
      }

      const action = algorithm.implementation(previousTicks, positions[i]);
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

    const { algorithm, writeToFile, slippage = { bps: 0 } } = strategies[i];
    const table: [string, string][] = [];
    table.push(['Algorithm', algorithm.name]);
    table.push(['Slippage', slippageToString(slippage)]);
    table.push(['First tick open', firstTick ? '$' + firstTick.toString() : 'N/A']);
    table.push(['Last tick close', lastTick ? '$' + lastTick.toString() : 'N/A']);
    if (firstTick && lastTick) {
      table.push(['Ticker return', withCommasRounded(tickerReturn) + '%']);
      table.push(['Ticker final balance', '$' + withCommasRounded(tickerFinalBalance)]);
    }
    table.push(['Final balance', '$' + withCommasRounded(balances[i])]);
    table.push(['Return', withCommasRounded(balances[i] - 100) + '%']);
    if (firstTick && lastTick) {
      table.push([
        'Strategy/ticker return',
        withCommasRounded(balances[i] / tickerFinalBalance) + 'x',
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
  }
}
