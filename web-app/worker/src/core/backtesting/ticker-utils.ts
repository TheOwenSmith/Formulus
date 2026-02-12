import { aggregateTimestamps, tickerSchema, type Ticker, type Timestamp } from '@shared/api';
import { type Algorithm } from '@worker/core/algorithms/algorithm';
import type { AnyUserAlgorithmType } from '@worker/core/algorithms/user-algorithm';
import {
  badRequest,
  fromThrowable,
  internal,
  safeReduce,
  type AppError,
} from '@worker/utils/error-handling';
import fs from 'fs';
import { err, ok, type Result } from 'neverthrow';
import z from 'zod';
import type { TickerData } from './backtest-algorithms-concurrently';

export type IndexedByAggregateByTicker<T> = Record<Timestamp, Record<Ticker, T>>;

export function emptyIndexByAggregateByTicker<T>(): IndexedByAggregateByTicker<T> {
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
  algorithmsByIndexByAggregate: Record<Timestamp, Map<number, Algorithm | AnyUserAlgorithmType>>,
): Record<Timestamp, Ticker[]> {
  return aggregateTimestamps.reduce(
    (acc, aggregate) => {
      const distinctTickersSet = new Set<Ticker>();
      for (const algorithm of algorithmsByIndexByAggregate[aggregate].values()) {
        getTickers(algorithm).forEach((ticker) => distinctTickersSet.add(ticker));
      }
      acc[aggregate] = Array.from(distinctTickersSet);
      return acc;
    },
    {} as Record<Timestamp, Ticker[]>,
  );
}

export function getTickers(algorithm: Algorithm | AnyUserAlgorithmType): Ticker[] {
  return 'tickers' in algorithm ? algorithm.tickers : [algorithm.ticker];
}

export function getAllTickers(distinctTickersByAggregate: Record<Timestamp, Ticker[]>): Ticker[] {
  return Array.from(
    aggregateTimestamps.reduce((acc, aggregate) => {
      distinctTickersByAggregate[aggregate].forEach((ticker) => acc.add(ticker));
      return acc;
    }, new Set<Ticker>()),
  );
}

export function getFilenameAndIndexByAggregateByTicker(
  tickerData: TickerData[],
  distinctTickersByAggregate: Record<Timestamp, Ticker[]>,
  verboseLogging = false,
): Result<
  {
    filenameByAggregateByTicker: IndexedByAggregateByTicker<string>;
    indexByAggregateByTicker: IndexedByAggregateByTicker<string>;
  },
  AppError
> {
  const userInputtedDataByAggregateByTicker = emptyIndexByAggregateByTicker<{
    filename: string;
    index: string;
  }>();
  for (const tickData of tickerData) {
    const { ticker, aggregate, filename, index } = tickData;
    if (ticker in userInputtedDataByAggregateByTicker[aggregate]) {
      return err(badRequest(`Duplicate data for '${ticker}' (${aggregate}) provided`));
    }

    // Resolve filename and index
    const impliedFilename = `./data/cleaned/${ticker}_${aggregate}.csv`;
    if (verboseLogging && filename == undefined) {
      console.warn(
        `Missing filename for '${ticker}' (${aggregate}); assuming filename '${impliedFilename}'`,
      );
    }
    const impliedIndex = `./data/index/${ticker}_${aggregate}.idx`;
    if (verboseLogging && index == undefined) {
      console.warn(
        `Missing index for '${ticker}' (${aggregate}); assuming index '${impliedIndex}'`,
      );
    }

    const resolvedFilename = filename ?? impliedFilename;
    const resolvedIndex = index ?? impliedIndex;

    // Check if resolvedFilename and resolvedIndex exist
    if (!fs.existsSync(resolvedFilename)) {
      return err(internal(undefined, `Filename '${resolvedFilename}' does not exist`));
    }
    if (!fs.existsSync(resolvedIndex)) {
      return err(internal(undefined, `Index '${resolvedIndex}' does not exist`));
    }

    userInputtedDataByAggregateByTicker[aggregate][ticker] = {
      filename: resolvedFilename,
      index: resolvedIndex,
    };
  }

  const filenameByAggregateByTicker = emptyIndexByAggregateByTicker<string>();
  const indexByAggregateByTicker = emptyIndexByAggregateByTicker<string>();
  for (const aggregate of aggregateTimestamps) {
    for (const ticker of distinctTickersByAggregate[aggregate]) {
      if (ticker in userInputtedDataByAggregateByTicker[aggregate]) {
        filenameByAggregateByTicker[aggregate][ticker] =
          userInputtedDataByAggregateByTicker[aggregate][ticker].filename;
        indexByAggregateByTicker[aggregate][ticker] =
          userInputtedDataByAggregateByTicker[aggregate][ticker].index;
      } else {
        const impliedFilename = `./data/cleaned/${ticker}_${aggregate}.csv`;
        const impliedIndex = `./data/index/${ticker}_${aggregate}.idx`;

        if (verboseLogging) {
          console.warn(
            `Missing data for '${ticker}' (${aggregate}); assuming filename '${impliedFilename}' and index '${impliedIndex}'`,
          );
        }

        if (!fs.existsSync(impliedFilename)) {
          return err(internal(undefined, `Assumed filename '${impliedFilename}' does not exist`));
        }
        if (!fs.existsSync(impliedIndex)) {
          return err(internal(undefined, `Assumed index '${impliedIndex}' does not exist`));
        }
        filenameByAggregateByTicker[aggregate][ticker] = impliedFilename;
        indexByAggregateByTicker[aggregate][ticker] = impliedIndex;
      }
    }
  }

  for (const aggregate of aggregateTimestamps) {
    for (const ticker in userInputtedDataByAggregateByTicker[aggregate]) {
      if (
        !(ticker in filenameByAggregateByTicker[aggregate]) ||
        !(ticker in indexByAggregateByTicker[aggregate])
      ) {
        console.warn(
          `Received data for '${ticker}' (${aggregate}), but no algorithm is configured to use it`,
        );
      }
    }
  }
  return ok({
    filenameByAggregateByTicker,
    indexByAggregateByTicker,
  });
}

const slippageJsonlLineSchema = z.object({
  ticker: tickerSchema,
  slippage: z.number(),
});
export function getMarketSlippageByTicker(
  allTickers: Ticker[],
  userInputtedSlippageByTicker: Partial<Record<Ticker, number>> = {},
): Result<Record<Ticker, number>, AppError> {
  const slippageFileContentResponse = fromThrowable(
    () => fs.readFileSync(`./data/slippage.jsonl`, { encoding: 'utf8' }),
    (e) => internal(e),
  );
  if (slippageFileContentResponse.isErr()) return err(slippageFileContentResponse.error);
  const slippageFileContent = slippageFileContentResponse.value;

  const defaultSlippageByTickerResult = safeReduce(
    slippageFileContent.split('\n'),
    (acc: Record<Ticker, number>, line: string): Result<Record<Ticker, number>, AppError> => {
      if (line === '') return ok(acc);

      const parseJsonResponse = fromThrowable(
        () => JSON.parse(line),
        (e) => internal(e),
      );
      if (parseJsonResponse.isErr()) {
        return err(parseJsonResponse.error);
      }
      const parsedJson = parseJsonResponse.value;

      return fromThrowable(
        () => slippageJsonlLineSchema.parse(parsedJson),
        (e) => internal(e),
      ).map(({ ticker, slippage }) => {
        // Add to slippage by ticker
        acc[ticker] = slippage;
        return acc;
      });
    },
    {} as Record<Ticker, number>,
  );

  if (defaultSlippageByTickerResult.isErr()) return err(defaultSlippageByTickerResult.error);
  const defaultSlippageByTicker = defaultSlippageByTickerResult.value;

  const marketSlippageByTicker = {} as Record<Ticker, number>;
  for (const ticker of allTickers) {
    if (ticker in userInputtedSlippageByTicker) {
      marketSlippageByTicker[ticker] = userInputtedSlippageByTicker[ticker] ?? 0;
    } else {
      marketSlippageByTicker[ticker] = defaultSlippageByTicker[ticker];
    }
  }
  return ok(marketSlippageByTicker);
}
