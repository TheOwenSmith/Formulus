import { type Algorithm } from '@/algorithms/create-simple-algorithm';
import { aggregateTimestamps, type Ticker, type Timestamp } from '@/fetch/fetch';
import { compareDays, dateToDay, type Day } from '@/utils/date-utils';
import { tryAsync } from '@/utils/errorHandling';
import fs from 'fs';
import type { TickerData } from './backtest-algorithms-concurrently';
import type { AggregateDataIterator, Bar } from './read-data';

export type IndexedByAggregateByTicker<T> = Record<Timestamp, Record<Ticker, T>>;
export type IndexedByAggregateByAlgorithm<T> = Record<Timestamp, T[]>;

export type TickerDataIndexed = IndexedByAggregateByTicker<[filename: string, slippage: number]>;

export function emptyIndexByAggregateByTicker<T>(): IndexedByAggregateByTicker<T> {
  return aggregateTimestamps.reduce((acc, aggregate) => {
    acc[aggregate] = {} as Record<Ticker, T>;
    return acc;
  }, {} as IndexedByAggregateByTicker<T>);
}

export function createIndexByAggregateByTicker<T>(
  distinctTickersByAggregate: Record<Timestamp, Ticker[]>,
  fillFn: (aggregate: Timestamp, ticker: Ticker) => T,
): IndexedByAggregateByTicker<T> {
  return aggregateTimestamps.reduce((acc, aggregate) => {
    for (const ticker of distinctTickersByAggregate[aggregate]) {
      acc[aggregate][ticker] = fillFn(aggregate, ticker);
    }
    return acc;
  }, {} as IndexedByAggregateByTicker<T>);
}

export function getDistinctTickersByAggregate(
  algorithmsByAggregate: Record<Timestamp, Algorithm[]>,
): Record<Timestamp, Ticker[]> {
  return aggregateTimestamps.reduce(
    (acc, aggregate) => {
      const distinctTickersSet = algorithmsByAggregate[aggregate].reduce((acc, algorithm) => {
        algorithm.tickers.forEach((ticker) => acc.add(ticker));
        return acc;
      }, new Set<Ticker>());

      acc[aggregate] = Array.from(distinctTickersSet);
      return acc;
    },
    {} as Record<Timestamp, Ticker[]>,
  );
}

export function getTickerDataByAggregateByTicker(
  tickerData: TickerData[],
  distinctTickersByAggregate: Record<Timestamp, Ticker[]>,
  verboseLogging = false,
): TickerDataIndexed {
  const userInputtedTickerDataIndexed: TickerDataIndexed =
    emptyIndexByAggregateByTicker<[filename: string, slippage: number]>();
  for (const tickData of tickerData) {
    const { ticker, aggregate, slippage = 0, filename } = tickData;
    if (ticker in userInputtedTickerDataIndexed[aggregate]) {
      throw new Error(`Duplicate data for '${ticker}' (${aggregate}) provided`);
    }

    // Resolve filename
    const impliedFilename = `./data/cleaned/${ticker}_${aggregate}.csv`;
    if (verboseLogging && filename == undefined) {
      console.error(
        `Missing filename for '${ticker}' (${aggregate}); assuming filename '${impliedFilename}'`,
      );
    }
    const resolvedFilename = filename ?? impliedFilename;

    // Check if file exists
    if (!fs.existsSync(resolvedFilename)) {
      throw new Error(`Filename '${resolvedFilename}' does not exist`);
    }

    userInputtedTickerDataIndexed[aggregate][ticker] = [resolvedFilename, slippage];
  }

  const outputTickerDataIndexed: TickerDataIndexed = createIndexByAggregateByTicker(
    distinctTickersByAggregate,
    (aggregate, ticker) => {
      if (ticker in userInputtedTickerDataIndexed[aggregate]) {
        return userInputtedTickerDataIndexed[aggregate][ticker];
      } else {
        const impliedFilename = `./data/cleaned/${ticker}_${aggregate}.csv`;
        const impliedSlippage = 0;

        if (verboseLogging) {
          console.error(
            `Missing data for '${ticker}' (${aggregate}); assuming filename '${impliedFilename}' and slippage ${impliedSlippage}bps`,
          );
        }

        if (!fs.existsSync(impliedFilename)) {
          throw new Error(`Filename '${impliedFilename}' does not exist`);
        }
        return [impliedFilename, impliedSlippage];
      }
    },
  );

  for (const aggregate of aggregateTimestamps) {
    for (const ticker in userInputtedTickerDataIndexed[aggregate]) {
      if (!(ticker in outputTickerDataIndexed[aggregate])) {
        console.error(
          `Received data for '${ticker}' (${aggregate}), but no algorithm is configured to use it`,
        );
      }
    }
  }
  return outputTickerDataIndexed;
}

export function createIndexByAggregateByAlgorithm<T>(
  algorithmsByAggregate: Record<Timestamp, Algorithm[]>,
  fillFn: (timestamp: Timestamp, algorithmIndex: number) => T,
): IndexedByAggregateByAlgorithm<T> {
  return aggregateTimestamps.reduce((acc, aggregate) => {
    acc[aggregate] = Array.from(
      { length: algorithmsByAggregate[aggregate].length },
      (_, algorithmIndex) => fillFn(aggregate, algorithmIndex),
    );
    return acc;
  }, {} as IndexedByAggregateByAlgorithm<T>);
}

export async function matchAggregateDataIterators(
  tickerIteratorByAggregateByTicker: IndexedByAggregateByTicker<AggregateDataIterator>,
  startDay?: Day,
): Promise<[startDay: Day, firstBarByAggregateByTicker: IndexedByAggregateByTicker<Bar>]> {
  const firstBarByAggregateByTicker = {} as IndexedByAggregateByTicker<Bar>;

  // Get latest first bar timestamp off all iterator
  let latestFirstBarTimestamp = '';
  let latestFirstBarIteratorAggregateTicker: [Timestamp, Ticker] | null = null;
  for (const aggregate of aggregateTimestamps) {
    for (const ticker in tickerIteratorByAggregateByTicker[aggregate]) {
      const iterator = tickerIteratorByAggregateByTicker[aggregate][ticker];
      const firstBarIteratorResultResponse = await tryAsync(() => iterator.next());
      if (!firstBarIteratorResultResponse.ok) throw firstBarIteratorResultResponse.error;
      const firstBarIteratorResult = firstBarIteratorResultResponse.data;

      if (firstBarIteratorResult.done) {
        throw new Error('Iterator is done before matching');
      }

      const firstBar = firstBarIteratorResult.value;
      const firstBarTimestamp = firstBar[0];
      if (latestFirstBarTimestamp === '' || firstBarTimestamp > latestFirstBarTimestamp) {
        latestFirstBarTimestamp = firstBarTimestamp;
        latestFirstBarIteratorAggregateTicker = [aggregate, ticker];
        firstBarByAggregateByTicker[aggregate][ticker] = firstBar;
      }
    }
  }

  if (latestFirstBarTimestamp === '') {
    throw new Error('Failed to find latest first bar day');
  }

  // If start day is provided, ensure all iterator are at or after the start day
  let latestFirstBarDay = dateToDay(latestFirstBarTimestamp);
  if (startDay != undefined) {
    const comp = compareDays(latestFirstBarDay, startDay);
    if (comp > 0) {
      throw new Error(
        `Data is missing through ${latestFirstBarDay.join('-')}; the provided start day ${startDay.join('-')} is not sufficient`,
      );
    } else if (comp < 0) {
      latestFirstBarDay = startDay;
      latestFirstBarIteratorAggregateTicker = null;
    }
  }

  // Match all iterators to the latest first tick iterator
  for (const aggregate of aggregateTimestamps) {
    for (const ticker in tickerIteratorByAggregateByTicker[aggregate]) {
      if (
        aggregate === latestFirstBarIteratorAggregateTicker?.[0] &&
        ticker === latestFirstBarIteratorAggregateTicker?.[1]
      ) {
        continue;
      }
      const iterator = tickerIteratorByAggregateByTicker[aggregate][ticker];

      let current = await iterator.next();
      while (!current.done) {
        const comp = compareDays(dateToDay(current.value[0]), latestFirstBarDay);
        if (comp === 0) {
          break;
        } else if (comp > 0) {
          throw new Error('Iterator is ahead of latest first bar');
        }

        const nextBarResponse = await tryAsync(() => iterator.next());
        if (!nextBarResponse.ok) throw nextBarResponse.error;
        current = nextBarResponse.data;
      }

      if (current.done) {
        throw new Error('Iterator is done before matching');
      }

      // Set first bar
      firstBarByAggregateByTicker[aggregate][ticker] = current.value;
    }
  }
  return [latestFirstBarDay, firstBarByAggregateByTicker];
}

const MAX_TICKERS_TO_SHOW = 3;
export function tickersToString(tickers: Ticker[]): string {
  return (
    tickers.slice(0, MAX_TICKERS_TO_SHOW).join(',') +
    (tickers.length > MAX_TICKERS_TO_SHOW ? `,...${tickers.length - MAX_TICKERS_TO_SHOW} more` : '')
  );
}
