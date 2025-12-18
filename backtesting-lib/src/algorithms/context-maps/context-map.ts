import { Action, type Algorithm, type AlgorithmImplementation } from '@/algorithms/algorithm';
import {} from '@/algorithms/simple-algorithm';
import type { TopKAlgorithm } from '@/algorithms/top-k-algorithm';
import { getAggregateDataIterator, type Bar } from '@/backtesting/read-data';
import type { Ticker, Timestamp } from '@/fetch/types';
import { toValidTimespan } from '@/utils/date-utils';
import { trySync } from '@/utils/errorHandling';
import { isRecord } from '@/utils/types';
import z, { ZodType } from 'zod';

export async function createContextMap<T>({
  contextLength,
  encodeContext,
  tickDataFilename,
  timespan,
  verboseLogging = false,
}: {
  contextLength: number;
  encodeContext: (context: Bar[]) => T;
  tickDataFilename: string;
  timespan?: [string | undefined, string | undefined];
  verboseLogging?: boolean;
}): Promise<Map<T, number>> {
  if (contextLength < 1) {
    throw new Error('Context length must be at least 1');
  }

  const timespanDays: [string | undefined, string | undefined] = toValidTimespan(timespan);

  const getIteratorResponse = trySync(() =>
    getAggregateDataIterator(tickDataFilename, verboseLogging),
  );
  if (!getIteratorResponse.ok) {
    throw getIteratorResponse.error;
  }
  const iterator = getIteratorResponse.data;

  const outcomeByHistoryEncoded = new Map<T, [sum: number, count: number]>();
  const previousBars: Bar[] = [];
  for await (const bar of iterator) {
    // If bar is before start of timespan, skip
    if (timespanDays[0] != undefined && bar[0] < timespanDays[0]) {
      continue;
    }
    // If bar is after end of timespan, break
    if (timespanDays[1] != undefined && bar[0] > timespanDays[1]) {
      break;
    }

    if (previousBars.length < contextLength) {
      previousBars.push(bar);
      continue;
    }

    const historyEncoded: T = encodeContext(previousBars);
    const outcomes = outcomeByHistoryEncoded.get(historyEncoded) ?? [0, 0];

    const prevBar = previousBars.at(-1)![4];
    const nextBarPercentChange = ((bar[4] - prevBar) / prevBar) * 100;
    outcomes[0] += nextBarPercentChange;
    outcomes[1]++;
    outcomeByHistoryEncoded.set(historyEncoded, outcomes);

    previousBars.shift();
    previousBars.push(bar);
  }

  const contextMap = new Map<T, number>();
  for (const [state, [sum, count]] of outcomeByHistoryEncoded) {
    contextMap.set(state, sum / count);
  }
  return contextMap;
}

export function serializeContextMap(contextMap: Map<number, number>): string {
  return JSON.stringify(Array.from(contextMap));
}

export function deserializeContextMap<T>(
  serializedContextMap: string,
  keySchema: ZodType<T>,
): Map<T, number> {
  const parseJsonResponse = trySync(() => JSON.parse(serializedContextMap));
  if (!parseJsonResponse.ok) throw parseJsonResponse.error;
  const parsedJson = parseJsonResponse.data;

  const contextMapArraySchema = z.tuple([keySchema, z.number()]).array();
  const schemaParseResponse = trySync(() => contextMapArraySchema.parse(parsedJson));
  if (!schemaParseResponse.ok) throw schemaParseResponse.error;
  const parsedContextArray = schemaParseResponse.data;

  return new Map<T, number>(parsedContextArray);
}

export function createAlgorithmFromContextMaps<T>({
  aggregate,
  algorithmMaxHoldingProportion,
  contextLength,
  contextMaps,
  encodeContext,
  name,
  onUnseenStateAction = Action.HOLD,
  threshold,
  tickers,
}: {
  aggregate: Timestamp;
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  contextMaps: Record<Ticker, Map<T, number>> | Map<T, number>;
  encodeContext: (contextt: Bar[]) => T;
  name: string;
  onUnseenStateAction?: Action;
  threshold: number;
  tickers: [Ticker, ...Ticker[]];
}): Algorithm {
  if (isRecord(contextMaps)) {
    for (const ticker of tickers) {
      if (!(ticker in contextMaps)) {
        throw new Error(`Missing context map for ticker '${ticker}'`);
      }
    }
  }

  let implementation: AlgorithmImplementation;
  if (isRecord(contextMaps)) {
    // Individualized context map for each ticker
    implementation = (context: Record<Ticker, Bar[]>): Record<Ticker, Action> => {
      const actionsByTicker = {} as Record<Ticker, Action>;

      for (const ticker in contextMaps) {
        const historyEncoded: T = encodeContext(context[ticker]);
        if (!contextMaps[ticker].has(historyEncoded)) {
          actionsByTicker[ticker] = onUnseenStateAction;
          continue;
        }
        actionsByTicker[ticker] =
          contextMaps[ticker].get(historyEncoded)! > threshold ? Action.BUY : Action.SELL;
      }
      return actionsByTicker;
    };
  } else {
    // Generalize context map for all tickers
    implementation = (context: Record<Ticker, Bar[]>): Record<Ticker, Action> => {
      const actionsByTicker = {} as Record<Ticker, Action>;

      for (const ticker of tickers) {
        const historyEncoded: T = encodeContext(context[ticker]);
        if (!contextMaps.has(historyEncoded)) {
          actionsByTicker[ticker] = onUnseenStateAction;
          continue;
        }
        actionsByTicker[ticker] =
          contextMaps.get(historyEncoded)! > threshold ? Action.BUY : Action.SELL;
      }
      return actionsByTicker;
    };
  }

  return {
    aggregate,
    algorithmMaxHoldingProportion,
    contextLength,
    implementation,
    name,
    tickers,
  };
}

export function createTopKAlgorithmFromContextMaps<T>({
  aggregate,
  algorithmMaxHoldingProportion,
  contextLength,
  contextMaps,
  encodeContext,
  k,
  name,
  onUnseenStateScore = 0,
  tickers,
}: {
  aggregate: Timestamp;
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  contextMaps: Record<Ticker, Map<T, number>> | Map<T, number>;
  encodeContext: (contextt: Bar[]) => T;
  k: number;
  name: string;
  onUnseenStateScore?: number;
  tickers: [Ticker, ...Ticker[]];
}): TopKAlgorithm {
  if (isRecord(contextMaps)) {
    for (const ticker of tickers) {
      if (!(ticker in contextMaps)) {
        throw new Error(`Missing context map for ticker '${ticker}'`);
      }
    }
  }

  const implementation = (
    context: Record<Ticker, Bar[]>,
    _position: Record<Ticker, number>,
  ): Record<Ticker, number> => {
    const scoreByTicker = {} as Record<Ticker, number>;

    if (isRecord(contextMaps)) {
      // Individualized context map for each ticker
      for (const ticker in contextMaps) {
        const historyEncoded: T = encodeContext(context[ticker]);
        scoreByTicker[ticker] = contextMaps[ticker].get(historyEncoded) ?? onUnseenStateScore;
      }
    } else {
      // Generalize contexted map for all tickers
      for (const ticker of tickers) {
        const historyEncoded: T = encodeContext(context[ticker]);
        scoreByTicker[ticker] = contextMaps.get(historyEncoded) ?? onUnseenStateScore;
      }
    }
    return scoreByTicker;
  };

  return {
    aggregate,
    algorithmMaxHoldingProportion,
    contextLength,
    implementation,
    k,
    name,
    tickers,
  };
}
