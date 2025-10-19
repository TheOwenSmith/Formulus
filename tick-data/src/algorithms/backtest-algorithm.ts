import { getAggregateDataIterator, type Tick } from '@/read-data';

export type Action = 'buy' | 'sell' | 'hold';
export type Algorithm = {
  implementation: (context: Tick[], position: number) => Action;
  contextLength: number;
};

export async function backtestAlgorithm(filename: string, algorithm: Algorithm) {
  const iterator = getAggregateDataIterator(filename);
  const previousTicks: Tick[] = [];
  let balance = 100;
  let position = 0;
  function closePosition(closePrice: number) {
    balance += position * closePrice;
    position = 0;
  }
  function openPosition(closePrice: number, isShort: boolean) {
    if (isShort) position -= balance / closePrice;
    else position += balance / closePrice;
    balance = 0;
  }

  for await (const tick of iterator) {
    if (previousTicks.length < algorithm.contextLength) {
      previousTicks.push(tick);
      continue;
    } else {
      previousTicks.shift();
      previousTicks.push(tick);
    }

    const action = algorithm.implementation(previousTicks, position);
    const closePrice = tick[4];
    if (action === 'hold') {
      continue;
    }

    if (position === 0) {
      if (action === 'buy') {
        // buy to open
        openPosition(closePrice, false);
      } else if (action === 'sell') {
        // sell to open
        openPosition(closePrice, true);
      }
      continue;
    }

    if (position > 0 && action === 'sell') {
      // sell to close
      closePosition(closePrice);
    } else if (position < 0 && action === 'buy') {
      // buy to close
      closePosition(closePrice);
    }
  }

  if (position !== 0) closePosition(previousTicks.at(-1)![4]);
  return balance;
}
