import { type Algorithm } from '@api/algorithms/algorithm';
import { aggregateTimestamps, type Ticker, type Timestamp } from '@api/fetch/types';
import { trySync } from '@api/utils/errorHandling';
import fs from 'fs';
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
): {
  filenameByAggregateByTicker: IndexedByAggregateByTicker<string>;
  indexByAggregateByTicker: IndexedByAggregateByTicker<string>;
} {
  const userInputtedDataByAggregateByTicker = emptyIndexByAggregateByTicker<{
    filename: string;
    index: string;
  }>();
  for (const tickData of tickerData) {
    const { ticker, aggregate, filename, index } = tickData;
    if (ticker in userInputtedDataByAggregateByTicker[aggregate]) {
      throw new Error(`Duplicate data for '${ticker}' (${aggregate}) provided`);
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
      throw new Error(`Filename '${resolvedFilename}' does not exist`);
    }
    if (!fs.existsSync(resolvedIndex)) {
      throw new Error(`Index '${resolvedIndex}' does not exist`);
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
          throw new Error(`Assumed filename '${impliedFilename}' does not exist`);
        }
        if (!fs.existsSync(impliedIndex)) {
          throw new Error(`Assumed index '${impliedIndex}' does not exist`);
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
  return {
    filenameByAggregateByTicker,
    indexByAggregateByTicker,
  };
}

const slippageJsonlLineSchema = z.object({
  ticker: z.string(),
  slippage: z.number(),
});
export function getMarketSlippageByTicker(
  allTickers: Ticker[],
  userInputtedSlippageByTicker: Partial<Record<Ticker, number>> = {},
): Record<Ticker, number> {
  if (!fs.existsSync(`./data/slippage.jsonl`)) {
    throw new Error(`Slippage file './data/slippage.jsonl' does not exist`);
  }

  const defaultSlippageByTicker = fs
    .readFileSync(`./data/slippage.jsonl`, { encoding: 'utf8' })
    .split('\n')
    .reduce(
      (acc, line) => {
        // Parse JSONL line
        if (line === '') return acc;

        const parseJsonResponse = trySync(() => JSON.parse(line));
        if (!parseJsonResponse.ok) throw parseJsonResponse.error;
        const parsedJson = parseJsonResponse.data;

        const zodParseResponse = trySync(() => slippageJsonlLineSchema.parse(parsedJson));
        if (!zodParseResponse.ok) throw zodParseResponse.error;
        const { ticker, slippage } = zodParseResponse.data;

        // Add to slippage by ticker
        acc[ticker] = slippage;
        return acc;
      },
      {} as Record<Ticker, number>,
    );

  const marketSlippageByTicker = {} as Record<Ticker, number>;
  for (const ticker of allTickers) {
    if (ticker in userInputtedSlippageByTicker) {
      marketSlippageByTicker[ticker] = userInputtedSlippageByTicker[ticker] ?? 0;
    } else {
      marketSlippageByTicker[ticker] = defaultSlippageByTicker[ticker];
    }
  }
  return marketSlippageByTicker;
}

const MAX_TICKERS_TO_SHOW = 3;
export function tickersToString(tickers: Ticker[]): string {
  return (
    tickers.slice(0, MAX_TICKERS_TO_SHOW).join(',') +
    (tickers.length > MAX_TICKERS_TO_SHOW ? `,...${tickers.length - MAX_TICKERS_TO_SHOW} more` : '')
  );
}
