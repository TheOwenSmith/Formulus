import { type Algorithm } from '@/algorithms/algorithm';
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
): Promise<{
  latestFirstBarTimestamp: string;
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
  return { latestFirstBarTimestamp, firstBarByAggregateByTicker };
}

export async function matchAggregateDataIterators(
  tickerIteratorByAggregateByTicker: Partial<IndexedByAggregateByTicker<AggregateDataIterator>>,
  startDay?: Day,
): Promise<[startDay: Day, firstBarByAggregateByTicker: IndexedByAggregateByTicker<Bar>]> {
  const { latestFirstBarTimestamp, firstBarByAggregateByTicker } = await getFirstIteratorBars(
    tickerIteratorByAggregateByTicker,
  );

  // Initialize actualStartDayTimestamp
  let actualStartDayTimestamp = '';
  if (startDay != undefined) {
    const latestFirstBarDay = timestampToDay(latestFirstBarTimestamp);
    const comp = compareDays(latestFirstBarDay, startDay);
    if (comp > 0) {
      throw new Error(
        `Data is missing through ${dayToString(latestFirstBarDay)}; the provided start day ${dayToString(startDay)} is not sufficient`,
      );
    } else if (comp === 0) {
      actualStartDayTimestamp = dayToString(startDay);
    }
  } else {
    actualStartDayTimestamp = latestFirstBarTimestamp.slice(0, 10);
  }

  // Match all iterators to the latest first bar iterator
  const startDayTimestamp = startDay != undefined ? dayToString(startDay) : '';
  for (const aggregate of aggregateTimestamps) {
    for (const ticker in tickerIteratorByAggregateByTicker[aggregate]) {
      if (
        actualStartDayTimestamp !== '' &&
        firstBarByAggregateByTicker[aggregate][ticker][0].slice(0, 10) === actualStartDayTimestamp
      ) {
        continue;
      }
      const iterator = tickerIteratorByAggregateByTicker[aggregate][ticker];

      let current = await iterator.next();
      while (!current.done) {
        const currentDayTimestamp = current.value[0].slice(0, 10);
        if (actualStartDayTimestamp !== '') {
          // If there is a set start day
          if (currentDayTimestamp === actualStartDayTimestamp) {
            break;
          } else if (currentDayTimestamp > actualStartDayTimestamp) {
            throw new Error(
              `Failed to match iterator '${ticker}' (${aggregate}) to the latest first bar; expected '${actualStartDayTimestamp}' but got '${current.value[0].slice(0, 10)}'`,
            );
          }
        } else if (currentDayTimestamp >= startDayTimestamp) {
          // If there is not a set start day and the current day is sufficient as a start day, we can set it as the actual start day and break
          actualStartDayTimestamp = currentDayTimestamp;
          break;
        }

        const nextBarResponse = await tryAsync(() => iterator.next());
        if (!nextBarResponse.ok) throw nextBarResponse.error;
        current = nextBarResponse.data;
      }

      if (current.done) {
        throw new Error(
          `Data is missing for ticker '${ticker}' (${aggregate}); Failed to match to start day '${actualStartDayTimestamp}'`,
        );
      }

      // Set first bar
      firstBarByAggregateByTicker[aggregate][ticker] = current.value;
    }
  }

  if (actualStartDayTimestamp === '') {
    throw new Error('Failed to find actual start day');
  }

  const actualStartDay = timestampToDay(actualStartDayTimestamp);
  return [actualStartDay, firstBarByAggregateByTicker];
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
}): Promise<[startDay: Day, endDay: Day, linesToProcess: number]> {
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
  const [startDay, firstBarByAggregateByTicker] = matchIteratorResponse.data;

  let endDay: Day | null = null;
  let linesToProcess = 0;
  for (const aggregate of aggregateTimestamps) {
    // Skip if no tickers
    const tickerIteratorByTicker = tickerIteratorByAggregateByTicker[aggregate];
    const numTickers = Object.keys(tickerIteratorByTicker).length;
    if (numTickers === 0) {
      continue;
    }

    // Choose random ticker to get first day
    let nextBarDay = timestampToDay(
      firstBarByAggregateByTicker[aggregate][Object.keys(tickerIteratorByTicker)[0]][0],
    );

    // Keep iterating until some tickers have no more bars or end of timespan is reached
    let hasNextBar = true;
    let endDayForAggregate: Day | null = null;
    while (hasNextBar) {
      let nextBarTimestamp = '';
      const currentBarDay = nextBarDay;
      for (const ticker in tickerIteratorByTicker) {
        const nextBarIteratorResult = await tickerIteratorByTicker[ticker].next();
        if (nextBarIteratorResult.done) {
          hasNextBar = false;
          endDayForAggregate = currentBarDay;
          break;
        }

        const nextBar = nextBarIteratorResult.value;
        if (nextBarTimestamp === '') {
          nextBarDay = timestampToDay(nextBar[0]);
          if (timespanDays[1] != undefined && compareDays(nextBarDay, timespanDays[1]) > 0) {
            hasNextBar = false;
            endDayForAggregate = currentBarDay;
            break;
          }
          nextBarTimestamp = nextBar[0];
        }
      }
      linesToProcess += numTickers;
    }

    for (const ticker in tickerIteratorByTicker) {
      tickerIteratorByTicker[ticker].close();
    }

    if (endDay == null || compareDays(endDayForAggregate!, endDay) < 0) {
      endDay = endDayForAggregate!;
    }
  }
  return [startDay, endDay!, linesToProcess];
}

const MAX_TICKERS_TO_SHOW = 3;
export function tickersToString(tickers: Ticker[]): string {
  return (
    tickers.slice(0, MAX_TICKERS_TO_SHOW).join(',') +
    (tickers.length > MAX_TICKERS_TO_SHOW ? `,...${tickers.length - MAX_TICKERS_TO_SHOW} more` : '')
  );
}
