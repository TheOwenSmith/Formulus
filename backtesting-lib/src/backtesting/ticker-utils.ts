import { type Algorithm } from '@/algorithms/algorithm';
import { aggregateTimestamps, type Ticker, type Timestamp } from '@/fetch/types';
import fs from 'fs';
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

export function getTickerDataByAggregateByTicker(
  tickerData: TickerData[],
  distinctTickersByAggregate: Record<Timestamp, Ticker[]>,
  verboseLogging = false,
): {
  slippageByAggregateByTicker: IndexedByAggregateByTicker<number>;
  filenameByAggregateByTicker: IndexedByAggregateByTicker<string>;
  indexByAggregateByTicker: IndexedByAggregateByTicker<string>;
} {
  const userInputtedDataByAggregateByTicker = emptyIndexByAggregateByTicker<{
    slippage: number;
    filename: string;
    index: string;
  }>();
  for (const tickData of tickerData) {
    const { ticker, aggregate, slippage = 0, filename, index } = tickData;
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
      slippage,
      filename: resolvedFilename,
      index: resolvedIndex,
    };
  }

  const slippageByAggregateByTicker = emptyIndexByAggregateByTicker<number>();
  const filenameByAggregateByTicker = emptyIndexByAggregateByTicker<string>();
  const indexByAggregateByTicker = emptyIndexByAggregateByTicker<string>();
  for (const aggregate of aggregateTimestamps) {
    for (const ticker of distinctTickersByAggregate[aggregate]) {
      if (ticker in userInputtedDataByAggregateByTicker[aggregate]) {
        slippageByAggregateByTicker[aggregate][ticker] =
          userInputtedDataByAggregateByTicker[aggregate][ticker].slippage;
        filenameByAggregateByTicker[aggregate][ticker] =
          userInputtedDataByAggregateByTicker[aggregate][ticker].filename;
        indexByAggregateByTicker[aggregate][ticker] =
          userInputtedDataByAggregateByTicker[aggregate][ticker].index;
      } else {
        const impliedSlippage = 0;
        const impliedFilename = `./data/cleaned/${ticker}_${aggregate}.csv`;
        const impliedIndex = `./data/index/${ticker}_${aggregate}.idx`;

        if (verboseLogging) {
          console.warn(
            `Missing data for '${ticker}' (${aggregate}); assuming slippage ${impliedSlippage}bps, filename '${impliedFilename}', and index '${impliedIndex}'`,
          );
        }

        if (!fs.existsSync(impliedFilename)) {
          throw new Error(`Assumed filename '${impliedFilename}' does not exist`);
        }
        if (!fs.existsSync(impliedIndex)) {
          throw new Error(`Assumed index '${impliedIndex}' does not exist`);
        }
        slippageByAggregateByTicker[aggregate][ticker] = impliedSlippage;
        filenameByAggregateByTicker[aggregate][ticker] = impliedFilename;
        indexByAggregateByTicker[aggregate][ticker] = impliedIndex;
      }
    }
  }

  for (const aggregate of aggregateTimestamps) {
    for (const ticker in userInputtedDataByAggregateByTicker[aggregate]) {
      if (
        !(ticker in slippageByAggregateByTicker[aggregate]) ||
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
    slippageByAggregateByTicker,
    filenameByAggregateByTicker,
    indexByAggregateByTicker,
  };
}

const MAX_TICKERS_TO_SHOW = 3;
export function tickersToString(tickers: Ticker[]): string {
  return (
    tickers.slice(0, MAX_TICKERS_TO_SHOW).join(',') +
    (tickers.length > MAX_TICKERS_TO_SHOW ? `,...${tickers.length - MAX_TICKERS_TO_SHOW} more` : '')
  );
}
