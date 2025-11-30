import {
  Action,
  createAlgorithmFromSimpleAlgorithm,
  type Algorithm,
} from '@/algorithms/create-simple-algorithm';
import { getAggregateDataIterator, type Bar } from '@/backtesting/read-data';
import type { Ticker, Timestamp } from '@/fetch/fetch';
import { trySync } from '@/utils/errorHandling';
import { withCommas } from '@/utils/number-utils';
import z from 'zod';

export const sophisticatedPrevBarsAlgorithm = ({
  aggregate,
  algorithmMaxHoldingProportion,
  contextLength,
  contextMap,
  name,
  ticker,
}: {
  aggregate: Timestamp;
  algorithmMaxHoldingProportion?: number;
  contextLength: number;
  contextMap: Map<number, boolean>;
  name?: string;
  ticker: Ticker;
}): Algorithm =>
  createAlgorithmFromSimpleAlgorithm({
    aggregate,
    algorithmMaxHoldingProportion,
    contextLength,
    implementation: sophisticatedPrevBarsAlgorithmImplementation(contextMap),
    name: name ?? `Sophisticated Previous Bars (${contextLength})`,
    ticker,
  });

export const sophisticatedPrevBarsAlgorithmImplementation = (contextMap: Map<number, boolean>) => {
  return function (context: Bar[], _position: number): Action {
    const historyMasked: number = maskHistory(context);
    if (contextMap.has(historyMasked)) {
      return contextMap.get(historyMasked)! ? Action.BUY : Action.SELL;
    }
    return Action.HOLD;
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
  topP = 0.2,
  verboseLogging = false,
}: {
  tickDataFilename: string;
  contextLength: number;
  topP?: number;
  verboseLogging?: boolean;
}): Promise<[Map<number, boolean>, boolean]> {
  const getIteratorResponse = trySync(() =>
    getAggregateDataIterator(tickDataFilename, verboseLogging),
  );
  if (!getIteratorResponse.ok) {
    throw getIteratorResponse.error;
  }
  const iterator = getIteratorResponse.data;

  const outcomeMap = new Map<number, [sum: number, total: number]>();
  const previousBars: Bar[] = [];
  for await (const bar of iterator) {
    if (previousBars.length < contextLength) {
      previousBars.push(bar);
      continue;
    }

    const historyMasked: number = maskHistory(previousBars);
    const compiledOutcome = outcomeMap.get(historyMasked) ?? [0, 0];

    const prevBar = previousBars.at(-1)![4];
    const nextBarPercentChange = ((bar[4] - prevBar) / prevBar) * 100;
    compiledOutcome[0] += nextBarPercentChange;
    compiledOutcome[1]++;
    outcomeMap.set(historyMasked, compiledOutcome);

    previousBars.shift();
    previousBars.push(bar);
  }

  const sortedOutcomeMap = [...outcomeMap.entries()].sort(
    (
      [_historyA, [nextBarPercentChangeSumA, totalBarsA]],
      [_historyB, [nextBarPercentChangeSumB, totalBarsB]],
    ) => {
      const averagePercentChangeA = nextBarPercentChangeSumA / totalBarsA;
      const averagePercentChangeB = nextBarPercentChangeSumB / totalBarsB;
      return averagePercentChangeB - averagePercentChangeA;
    },
  );

  const contextMap = new Map<number, boolean>();

  let i = 0;
  let topPMaxxed = false;
  for (; i < sortedOutcomeMap.length * topP; i++) {
    const [historyMasked, [nextBarPercentChangeSum, total]] = sortedOutcomeMap[i];
    const averagePercentChange = nextBarPercentChangeSum / total;
    if (averagePercentChange <= 0) {
      topPMaxxed = true;
      break;
    }
    contextMap.set(historyMasked, true);
  }
  for (; i < sortedOutcomeMap.length; i++) {
    const [historyMasked] = sortedOutcomeMap[i];
    contextMap.set(historyMasked, false);
  }

  if (verboseLogging && topPMaxxed) {
    console.log(`Context map of context length ${contextLength} maxxed at topP ${topP * 100}%`);
  }

  const emptyEntries = 2 ** contextLength - contextMap.size;
  if (verboseLogging && emptyEntries > 0) {
    console.error(
      `Context map of context length ${contextLength}, size ${withCommas(contextMap.size)}, and topP ${topP * 100}% has ${withCommas(emptyEntries)} empty entries`,
    );
  }
  return [contextMap, topPMaxxed];
}

export function serializeContextMap(contextMap: Map<number, boolean>): string {
  return JSON.stringify(Array.from(contextMap));
}

const contextMapArraySchema = z.tuple([z.number(), z.boolean()]).array();
export function deserializeContextMap(serializedContextMap: string): Map<number, boolean> {
  const parseJsonResponse = trySync(() => JSON.parse(serializedContextMap));
  if (!parseJsonResponse.ok) throw parseJsonResponse.error;
  const parsedJson = parseJsonResponse.data;

  const schemaParseResponse = trySync(() => contextMapArraySchema.parse(parsedJson));
  if (!schemaParseResponse.ok) throw schemaParseResponse.error;
  const parsedContextArray = schemaParseResponse.data;

  return new Map<number, boolean>(parsedContextArray);
}
