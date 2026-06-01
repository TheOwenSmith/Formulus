import { DATE_LENGTH, LINE_LENGTH } from '@shared/constants/search-index';
import { aggregateTimestamps, type Ticker } from '@shared/constants/trading';
import { toValidTimespan } from '@worker/utils/date-utils';
import {
  fromThrowableAsync,
  internal,
  safeReduce,
  type AppError,
} from '@worker/utils/error-handling';
import fsp from 'fs/promises';
import { err, ok, Result } from 'neverthrow';
import { getAggregateDataIterator, type AggregateDataIterator } from './read-data';
import { emptyIndexByAggregateByTicker, type IndexedByAggregateByTicker } from './ticker-utils';

const enum Bound {
  FIRST_GREATER_OR_EQUAL,
  FIRST_LESS_OR_EQUAL,
}

async function searchIndexForTickFileByte(
  indexFilename: string,
  findDate: string,
  bound: Bound,
): Promise<Result<[day: string, tickFileByte: number], AppError>> {
  // Open index file
  const openIndexFileResponse = await fromThrowableAsync(
    () => fsp.open(indexFilename, 'r'),
    (e) => internal(e),
  );
  if (openIndexFileResponse.isErr()) return err(openIndexFileResponse.error);
  const indexFile = openIndexFileResponse.value;

  // Binary search the index file for findDate
  const { size } = await indexFile.stat();
  let left = 0;
  let right = size / LINE_LENGTH - 1;

  // Reuse the same buffer for all reads
  const buffer = Buffer.alloc(LINE_LENGTH);

  while (left <= right) {
    const mid = (left + right) >> 1; // Math.floor((left + right) / 2);

    // Read the index line
    const readResponse = await fromThrowableAsync(
      () => indexFile.read(buffer, 0, LINE_LENGTH, mid * LINE_LENGTH),
      (e) => internal(e),
    );
    if (readResponse.isErr()) return err(readResponse.error);

    // Parse index line
    const indexLine = buffer.toString('utf-8');
    const indexDay = indexLine.slice(0, DATE_LENGTH);
    if (indexDay === findDate) {
      left = mid;
      right = mid;
      break;
    } else if (indexDay < findDate) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  // Read the index line
  const byte = (bound === Bound.FIRST_GREATER_OR_EQUAL ? left : right) * LINE_LENGTH;
  await indexFile.read(buffer, 0, LINE_LENGTH, byte);
  const indexLine = buffer.toString('utf-8');
  const day = indexLine.slice(0, DATE_LENGTH);
  const tickFileByte = parseInt(indexLine.slice(DATE_LENGTH));

  await indexFile.close();
  return ok([day, tickFileByte]);
}

async function getIndexTimespan(
  indexFilename: string,
): Promise<Result<[string, string], AppError>> {
  // Open index file
  const openIndexFileResponse = await fromThrowableAsync(
    () => fsp.open(indexFilename, 'r'),
    (e) => internal(e),
  );
  if (openIndexFileResponse.isErr()) return err(openIndexFileResponse.error);
  const indexFile = openIndexFileResponse.value;

  const { size } = await indexFile.stat();
  const buffer = Buffer.alloc(LINE_LENGTH);

  // Get first day
  await indexFile.read(buffer, 0, LINE_LENGTH, 0);
  const firstLine = buffer.toString('utf-8');
  const firstDay = firstLine.slice(0, DATE_LENGTH);

  // Get last day
  await indexFile.read(buffer, 0, LINE_LENGTH, size - LINE_LENGTH);
  const lastLine = buffer.toString('utf-8');
  const lastDay = lastLine.slice(0, DATE_LENGTH);

  await indexFile.close();
  return ok([firstDay, lastDay]);
}

async function getLongestPossibleTimespan(
  indexByAggregateByTicker: IndexedByAggregateByTicker<string>,
): Promise<Result<[string, string], AppError>> {
  let latestFirstDay: string | null = null;
  let earliestLastDay: string | null = null;
  for (const aggregate of aggregateTimestamps) {
    for (const ticker in indexByAggregateByTicker[aggregate]) {
      const indexFilename = indexByAggregateByTicker[aggregate][ticker];
      const getIndexTimespanResponse = await getIndexTimespan(indexFilename);
      if (getIndexTimespanResponse.isErr()) return err(getIndexTimespanResponse.error);
      const [firstDay, lastDay] = getIndexTimespanResponse.value;

      if (latestFirstDay == null || firstDay > latestFirstDay) {
        latestFirstDay = firstDay;
      }

      if (earliestLastDay == null || lastDay < earliestLastDay) {
        earliestLastDay = lastDay;
      }
    }
  }
  return ok([latestFirstDay!, earliestLastDay!]);
}

export async function getIteratorBounds(
  indexByAggregateByTicker: IndexedByAggregateByTicker<string>,
  userInputtedTimespan?: [string | null, string | null] | undefined,
): Promise<
  Result<
    {
      timespan: [string, string];
      iteratorBoundsByAggregateByTicker: IndexedByAggregateByTicker<[number, number]>;
    },
    AppError
  >
> {
  // Ensure timespan is valid
  const getCorrectedTimespanResponse = toValidTimespan(userInputtedTimespan);
  if (getCorrectedTimespanResponse.isErr()) return err(getCorrectedTimespanResponse.error);
  const correctedTimespan: [string | null, string | null] = getCorrectedTimespanResponse.value;

  // Get the longest possible timespan
  const getLongestPossibleTimespanResponse =
    await getLongestPossibleTimespan(indexByAggregateByTicker);
  if (getLongestPossibleTimespanResponse.isErr())
    return err(getLongestPossibleTimespanResponse.error);
  const longestPossibleTimespan = getLongestPossibleTimespanResponse.value;

  // Bound the timespan to the longest possible timespan
  const boundedTimespan: [string, string] = [
    longestPossibleTimespan[0],
    longestPossibleTimespan[1],
  ];

  if (correctedTimespan[0] != null) {
    if (correctedTimespan[0] >= longestPossibleTimespan[0]) {
      boundedTimespan[0] = correctedTimespan[0];
    } else {
      console.warn(
        `Requested start day '${correctedTimespan[0]}' is earlier than available data ${longestPossibleTimespan[0]}. Using earliest possible start day instead.`,
      );
    }
  }
  if (correctedTimespan[1] != null) {
    if (correctedTimespan[1] <= longestPossibleTimespan[1]) {
      boundedTimespan[1] = correctedTimespan[1];
    } else {
      console.warn(
        `Requested end day '${correctedTimespan[1]}' is later than available data ${longestPossibleTimespan[1]}. Using latest possible end day instead.`,
      );
    }
  }

  let timespan: [string, string] | null = null;
  const iteratorBoundsByAggregateByTicker = emptyIndexByAggregateByTicker<[number, number]>();
  for (const aggregate of aggregateTimestamps) {
    for (const ticker in indexByAggregateByTicker[aggregate]) {
      const indexFilename = indexByAggregateByTicker[aggregate][ticker];

      const searchIndexForStartDayResponse = await searchIndexForTickFileByte(
        indexFilename,
        boundedTimespan[0],
        Bound.FIRST_GREATER_OR_EQUAL,
      );
      if (searchIndexForStartDayResponse.isErr()) return err(searchIndexForStartDayResponse.error);
      const [startDay, tickFileStartByte] = searchIndexForStartDayResponse.value;

      const searchIndexForEndDayResponse = await searchIndexForTickFileByte(
        indexFilename,
        boundedTimespan[1],
        Bound.FIRST_LESS_OR_EQUAL,
      );
      if (searchIndexForEndDayResponse.isErr()) return err(searchIndexForEndDayResponse.error);
      const [endDay, tickFileEndByte] = searchIndexForEndDayResponse.value;

      if (timespan == null) {
        timespan = [startDay, endDay];
      } else if (startDay !== timespan[0]) {
        return err(
          internal(
            undefined,
            `Failed to match iterator '${ticker}' (${aggregate}) to the start day; expected '${startDay}' but got '${timespan[0]}'`,
          ),
        );
      } else if (endDay !== timespan[1]) {
        return err(
          internal(
            undefined,
            `Failed to match iterator '${ticker}' (${aggregate}) to the end day; expected '${endDay}' but got '${timespan[1]}'`,
          ),
        );
      }

      // Read stream end byte is include, so we subtract 3 to remove (\r, \n, first byte of new line)
      iteratorBoundsByAggregateByTicker[aggregate][ticker] = [
        tickFileStartByte,
        tickFileEndByte - 3,
      ];
    }
  }
  return ok({ timespan: timespan!, iteratorBoundsByAggregateByTicker });
}

export function countBytesToProcess(
  iteratorBoundsByAggregateByTicker: IndexedByAggregateByTicker<[number, number]>,
): number {
  let bytesToProcess = 0;
  for (const aggregate of aggregateTimestamps) {
    for (const ticker in iteratorBoundsByAggregateByTicker[aggregate]) {
      const [startByte, endByte] = iteratorBoundsByAggregateByTicker[aggregate][ticker];
      bytesToProcess += endByte - startByte + 1; // +1 because of inclusivity of the end byte
    }
  }
  return bytesToProcess;
}

export function getTickerIteratorsByTicker({
  distinctTickers,
  filenameByTicker,
  iteratorBoundsByTicker,
  parseStrictly,
  verboseLogging = false,
}: {
  distinctTickers: Ticker[];
  filenameByTicker: Record<Ticker, string>;
  iteratorBoundsByTicker: Record<Ticker, [number, number]>;
  parseStrictly: boolean;
  verboseLogging?: boolean;
}): Result<Record<Ticker, AggregateDataIterator>, AppError> {
  return safeReduce(
    distinctTickers,
    (acc: Record<Ticker, AggregateDataIterator>, ticker: Ticker) => {
      const tickDataFilename = filenameByTicker[ticker];
      if (verboseLogging) {
        console.log(`Fetching '${tickDataFilename}'...`);
      }

      const [startByte, endByte] = iteratorBoundsByTicker[ticker];

      return getAggregateDataIterator({
        endByte,
        filename: tickDataFilename,
        parseStrictly,
        startByte,
        verboseLogging,
      }).map((iterator) => {
        acc[ticker] = iterator;
        return acc;
      });
    },
    {} as Record<Ticker, AggregateDataIterator>,
  );
}
