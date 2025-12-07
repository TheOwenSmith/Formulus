import { type Algorithm } from '@/algorithms/create-simple-algorithm';
import { aggregateTimestamps, type Ticker, type Timestamp } from '@/fetch/fetch';
import { compareDays, dayToString, timestampToDay, type Day } from '@/utils/date-utils';
import { tryAsync, trySync } from '@/utils/errorHandling';
import fs from 'fs';
import type { TickerData } from './backtest-algorithms-concurrently';
import { getAggregateDataIterator, type AggregateDataIterator, type Bar } from './read-data';

export type IndexedByAggregateByTicker<T> = Record<Timestamp, Record<Ticker, T>>;

function emptyIndexByAggregateByTicker<T>(): IndexedByAggregateByTicker<T> {
  return aggregateTimestamps.reduce((acc, aggregate) => {
    acc[aggregate] = {} as Record<Ticker, T>;
    return acc;
  }, {} as IndexedByAggregateByTicker<T>);
}

export function createIndexByTicker<T>(
  distinctTickers: Ticker[],
  fillFn: (ticker: Ticker) => T,
): Record<Ticker, T> {
  return distinctTickers.reduce(
    (acc, ticker) => {
      acc[ticker] = fillFn(ticker);
      return acc;
    },
    {} as Record<Ticker, T>,
  );
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
): IndexedByAggregateByTicker<[filename: string, slippage: number]> {
  const userInputtedTickerDataIndexed: IndexedByAggregateByTicker<
    [filename: string, slippage: number]
  > = emptyIndexByAggregateByTicker<[filename: string, slippage: number]>();
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

  const outputTickerDataIndexed: IndexedByAggregateByTicker<[filename: string, slippage: number]> =
    emptyIndexByAggregateByTicker<[filename: string, slippage: number]>();
  for (const aggregate of aggregateTimestamps) {
    for (const ticker of distinctTickersByAggregate[aggregate]) {
      if (ticker in userInputtedTickerDataIndexed[aggregate]) {
        outputTickerDataIndexed[aggregate][ticker] =
          userInputtedTickerDataIndexed[aggregate][ticker];
      } else {
        const impliedFilename = `./data/cleaned/${ticker}_${aggregate}.csv`;
        const impliedSlippage = 0;

        if (verboseLogging) {
          console.error(
            `Missing data for '${ticker}' (${aggregate}); assuming filename '${impliedFilename}' and slippage ${impliedSlippage}bps`,
          );
        }

        if (!fs.existsSync(impliedFilename)) {
          throw new Error(`Assumed filename '${impliedFilename}' does not exist`);
        }
        outputTickerDataIndexed[aggregate][ticker] = [impliedFilename, impliedSlippage];
      }
    }
  }

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

export async function getFirstIteratorBars(
  tickerIteratorByAggregateByTicker: Partial<IndexedByAggregateByTicker<AggregateDataIterator>>,
  startDay?: Day,
): Promise<{
  startDayDefined: Day;
  firstBarByAggregateByTicker: IndexedByAggregateByTicker<Bar>;
}> {
  const firstBarByAggregateByTicker: IndexedByAggregateByTicker<Bar> =
    emptyIndexByAggregateByTicker();

  // Get latest first bar timestamp off all iterator
  let latestFirstBarTimestamp = '';
  for (const aggregate of aggregateTimestamps) {
    for (const ticker in tickerIteratorByAggregateByTicker[aggregate]) {
      const iterator = tickerIteratorByAggregateByTicker[aggregate][ticker];
      const firstBarIteratorResultResponse = await tryAsync(() => iterator.next());
      if (!firstBarIteratorResultResponse.ok) throw firstBarIteratorResultResponse.error;
      const firstBarIteratorResult = firstBarIteratorResultResponse.data;

      if (firstBarIteratorResult.done) {
        throw new Error(`Iterator '${ticker}' (${aggregate}) has no data`);
      }

      const firstBar = firstBarIteratorResult.value;
      firstBarByAggregateByTicker[aggregate][ticker] = firstBar;
      const firstBarTimestamp = firstBar[0];
      if (latestFirstBarTimestamp === '' || firstBarTimestamp > latestFirstBarTimestamp) {
        latestFirstBarTimestamp = firstBarTimestamp;
      }
    }
  }

  if (latestFirstBarTimestamp === '') {
    throw new Error('Failed to find latest first bar day');
  }

  // Set the latest first bar day to the timestampToDay of the latest first bar timestamp.
  let startDayDefined = timestampToDay(latestFirstBarTimestamp);
  if (startDay != undefined) {
    const comp = compareDays(startDayDefined, startDay);
    if (comp > 0) {
      throw new Error(
        `Data is missing through ${dayToString(startDayDefined)}; the provided start day ${dayToString(startDay)} is not sufficient`,
      );
    } else if (comp < 0) {
      startDayDefined = startDay;
    }
  }
  return { startDayDefined, firstBarByAggregateByTicker };
}

export async function matchAggregateDataIterators(
  tickerIteratorByAggregateByTicker: Partial<IndexedByAggregateByTicker<AggregateDataIterator>>,
  startDay?: Day,
): Promise<[startDay: Day, firstBarByAggregateByTicker: IndexedByAggregateByTicker<Bar>]> {
  const { startDayDefined, firstBarByAggregateByTicker } = await getFirstIteratorBars(
    tickerIteratorByAggregateByTicker,
    startDay,
  );

  // Match all iterators to the latest first tick iterator
  const startDayTimestamp = dayToString(startDayDefined);
  for (const aggregate of aggregateTimestamps) {
    for (const ticker in tickerIteratorByAggregateByTicker[aggregate]) {
      if (firstBarByAggregateByTicker[aggregate][ticker][0].slice(0, 10) === startDayTimestamp) {
        continue;
      }
      const iterator = tickerIteratorByAggregateByTicker[aggregate][ticker];

      let current = await iterator.next();
      while (!current.done) {
        const comp = current.value[0].slice(0, 10).localeCompare(startDayTimestamp);
        if (comp === 0) {
          break;
        } else if (comp > 0) {
          throw new Error(
            `Failed to match iterator '${ticker}' (${aggregate}) to the latest first bar`,
          );
        }

        const nextBarResponse = await tryAsync(() => iterator.next());
        if (!nextBarResponse.ok) throw nextBarResponse.error;
        current = nextBarResponse.data;
      }

      if (current.done) {
        throw new Error(
          `Data is missing for ticker '${ticker}' (${aggregate}); No bar is available for the matching start day: ${startDayTimestamp}.`,
        );
      }

      // Set first bar
      firstBarByAggregateByTicker[aggregate][ticker] = current.value;
    }
  }
  return [startDayDefined, firstBarByAggregateByTicker];
}

export function getTickerIteratorsByTicker({
  distinctTickers,
  tickerDataByTicker,
  verboseLogging = false,
}: {
  distinctTickers: Ticker[];
  tickerDataByTicker: Record<Ticker, [filename: string, slippage: number]>;
  verboseLogging: boolean;
}): Record<Ticker, AggregateDataIterator> {
  return distinctTickers.reduce(
    (acc, ticker) => {
      const tickDataFilename = tickerDataByTicker[ticker][0];
      if (verboseLogging) {
        console.log(`Fetching '${tickDataFilename}'...`);
      }

      const getIteratorResponse = trySync(() =>
        getAggregateDataIterator(tickDataFilename, verboseLogging),
      );
      if (!getIteratorResponse.ok) {
        throw getIteratorResponse.error;
      }
      acc[ticker] = getIteratorResponse.data;
      return acc;
    },
    {} as Record<Ticker, AggregateDataIterator>,
  );
}

export async function countLinesToProcess({
  distinctTickersByAggregate,
  tickerDataByAggregateByTicker,
  timespanDays,
  verboseLogging = true,
}: {
  distinctTickersByAggregate: Record<Timestamp, Ticker[]>;
  tickerDataByAggregateByTicker: IndexedByAggregateByTicker<[filename: string, slippage: number]>;
  timespanDays: [Day | undefined, Day | undefined];
  verboseLogging?: boolean;
}): Promise<[startDay: Day, number]> {
  const tickerIteratorByAggregateByTicker: IndexedByAggregateByTicker<AggregateDataIterator> =
    aggregateTimestamps.reduce((acc, aggregate) => {
      // Fetch ticker iterators for all tickers
      const gettickerIteratorByTickerResponse = trySync(() =>
        getTickerIteratorsByTicker({
          distinctTickers: distinctTickersByAggregate[aggregate],
          tickerDataByTicker: tickerDataByAggregateByTicker[aggregate],
          verboseLogging,
        }),
      );
      if (!gettickerIteratorByTickerResponse.ok) {
        throw gettickerIteratorByTickerResponse.error;
      }
      const tickerIteratorByTicker: Record<Ticker, AggregateDataIterator> =
        gettickerIteratorByTickerResponse.data;
      acc[aggregate] = tickerIteratorByTicker;
      return acc;
    }, {} as IndexedByAggregateByTicker<AggregateDataIterator>);

  const matchIteratorResponse = await tryAsync(() =>
    matchAggregateDataIterators(tickerIteratorByAggregateByTicker, timespanDays?.[0]),
  );
  if (!matchIteratorResponse.ok) throw matchIteratorResponse.error;
  const [startDay] = matchIteratorResponse.data;

  let linesToProcess = 0;
  for (const aggregate of aggregateTimestamps) {
    // Skip if no tickers
    const tickerIteratorByTicker = tickerIteratorByAggregateByTicker[aggregate];
    const numTickers = Object.keys(tickerIteratorByTicker).length;
    if (numTickers === 0) {
      continue;
    }

    let hasNextBar = true;
    while (hasNextBar) {
      for (const ticker in tickerIteratorByTicker) {
        const nextBarIteratorResult = await tickerIteratorByTicker[ticker].next();
        if (nextBarIteratorResult.done) {
          hasNextBar = false;
          break;
        }
      }
      linesToProcess += numTickers;
    }

    for (const ticker in tickerIteratorByTicker) {
      tickerIteratorByTicker[ticker].close();
    }
  }
  return [startDay, linesToProcess];
}

const MAX_TICKERS_TO_SHOW = 3;
export function tickersToString(tickers: Ticker[]): string {
  return (
    tickers.slice(0, MAX_TICKERS_TO_SHOW).join(',') +
    (tickers.length > MAX_TICKERS_TO_SHOW ? `,...${tickers.length - MAX_TICKERS_TO_SHOW} more` : '')
  );
}
