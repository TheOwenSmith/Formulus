import {
  Action,
  createAlgorithmFromSimpleAlgorithm,
  type Algorithm,
} from '@/algorithms/create-simple-algorithm';
import { getAggregateDataIterator, type Bar } from '@/backtesting/read-data';
import type { Ticker, Timestamp } from '@/fetch/fetch';
import { trySync } from '@/utils/errorHandling';
import z from 'zod';
import { createAlgorithmFromTopKAlgorithm } from './top-k-algorithm';

export const sophisticatedPrevBarsAlgorithm = ({
  aggregate,
  algorithmMaxHoldingProportion,
  contextLength,
  contextMap,
  name,
  threshold,
  ticker,
}: {
  aggregate: Timestamp;
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  contextMap: Map<number, number>;
  name?: string;
  threshold: number;
  ticker: Ticker;
}): Algorithm =>
  createAlgorithmFromSimpleAlgorithm({
    aggregate,
    algorithmMaxHoldingProportion,
    contextLength,
    implementation: sophisticatedPrevBarsAlgorithmImplementation(contextMap, threshold),
    name: name ?? `Sophisticated Previous Bars (${contextLength})`,
    ticker,
  });

export const sophisticatedPrevBarsAlgorithmImplementation = (
  contextMap: Map<number, number>,
  threshold: number,
) => {
  return function (context: Bar[], _position: number): Action {
    const historyMasked: number = maskHistory(context);
    if (contextMap.has(historyMasked)) {
      return contextMap.get(historyMasked)! > threshold ? Action.BUY : Action.SELL;
    }
    return Action.HOLD;
  };
};

export const compoundSophisticatedPrevBarsAlgorithm = ({
  aggregate,
  algorithmMaxHoldingProportion,
  contextLength,
  contextMapByTicker,
  k,
  name,
  tickers,
}: {
  aggregate: Timestamp;
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  contextMapByTicker: Record<Ticker, Map<number, number>>;
  k: number;
  name?: string;
  tickers: [Ticker, ...Ticker[]];
}): Algorithm =>
  createAlgorithmFromTopKAlgorithm({
    aggregate,
    algorithmMaxHoldingProportion,
    contextLength,
    implementation: compoundSophisticatedPrevBarsImplementation(contextMapByTicker),
    k,
    name: name ?? `Compound Sophisticated Previous Bars (${contextLength}-${k})`,
    tickers,
  });

export const compoundSophisticatedPrevBarsImplementation = (
  contextMapByTicker: Record<Ticker, Map<number, number>>,
) => {
  return function (
    context: Record<Ticker, Bar[]>,
    _position: Record<Ticker, number>,
  ): Record<Ticker, number> {
    const scoreByTicker = {} as Record<Ticker, number>;
    for (const ticker in contextMapByTicker) {
      const historyMasked: number = maskHistory(context[ticker]);
      scoreByTicker[ticker] = contextMapByTicker[ticker].get(historyMasked) ?? 0;
    }
    return scoreByTicker;
  };
};

function maskHistory(context: Bar[]): number {
  return context.reduce((acc, bar: Bar, index: number) => {
    const isGreen = bar[4] >= bar[1];
    return isGreen ? acc | (1 << index) : acc;
  }, 0);
}

export async function createContextMap({
  tickDataFilename,
  contextLength,
  verboseLogging = false,
}: {
  tickDataFilename: string;
  contextLength: number;
  verboseLogging?: boolean;
}): Promise<Map<number, number>> {
  const getIteratorResponse = trySync(() =>
    getAggregateDataIterator(tickDataFilename, verboseLogging),
  );
  if (!getIteratorResponse.ok) {
    throw getIteratorResponse.error;
  }
  const iterator = getIteratorResponse.data;

  const outcomesByState = new Map<number, [sum: number, count: number]>();
  const previousBars: Bar[] = [];
  for await (const bar of iterator) {
    if (previousBars.length < contextLength) {
      previousBars.push(bar);
      continue;
    }

    const historyMasked: number = maskHistory(previousBars);
    const outcomes = outcomesByState.get(historyMasked) ?? [0, 0];

    const prevBar = previousBars.at(-1)![4];
    const nextBarPercentChange = ((bar[4] - prevBar) / prevBar) * 100;
    outcomes[0] += nextBarPercentChange;
    outcomes[1]++;
    outcomesByState.set(historyMasked, outcomes);

    previousBars.shift();
    previousBars.push(bar);
  }

  const contextMap = new Map<number, number>();
  for (const [state, [sum, count]] of outcomesByState) {
    contextMap.set(state, sum / count);
  }
  return contextMap;
}

export function serializeContextMap(contextMap: Map<number, number>): string {
  return JSON.stringify(Array.from(contextMap));
}

const contextMapArraySchema = z.tuple([z.number(), z.number()]).array();
export function deserializeContextMap(serializedContextMap: string): Map<number, number> {
  const parseJsonResponse = trySync(() => JSON.parse(serializedContextMap));
  if (!parseJsonResponse.ok) throw parseJsonResponse.error;
  const parsedJson = parseJsonResponse.data;

  const schemaParseResponse = trySync(() => contextMapArraySchema.parse(parsedJson));
  if (!schemaParseResponse.ok) throw schemaParseResponse.error;
  const parsedContextArray = schemaParseResponse.data;

  return new Map<number, number>(parsedContextArray);
}
