import { trySync } from '@/utils/errorHandling';
import { withCommas } from '@/utils/number-utils';
import z from 'zod';
import { Action, type Algorithm } from './backtest-algorithms-concurrently';
import { getAggregateDataIterator, type Bar } from './read-data';

export const sophisticatedPrevBarsAlgorithm = (
  contextLength: number,
  confidenceMap: Map<number, boolean>,
  name?: string,
): Algorithm => ({
  name: name ?? `Sophisticated Previous Bars (${contextLength})`,
  implementation: sophisticatedPrevBarsAlgorithmImplementation(confidenceMap),
  contextLength,
});

export const sophisticatedPrevBarsAlgorithmImplementation = (
  confidenceMap: Map<number, boolean>,
) => {
  return function (context: Bar[], _position: number): Action {
    const historyMasked: number = maskHistory(context);
    if (confidenceMap.has(historyMasked)) {
      return confidenceMap.get(historyMasked)! ? Action.BUY : Action.SELL;
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
    getAggregateDataIterator(tickDataFilename, false, verboseLogging),
  );
  if (!getIteratorResponse.ok) {
    throw getIteratorResponse.error;
  }
  const iterator = getIteratorResponse.data;

  const outcomeMap = new Map<number, [number, number]>();
  const previousTicks: Bar[] = [];
  for await (const tick of iterator) {
    if (previousTicks.length < contextLength) {
      previousTicks.push(tick);
      continue;
    }

    const historyMasked: number = maskHistory(previousTicks);
    const previousOutcome = outcomeMap.get(historyMasked) ?? [0, 0];

    const prevTick = previousTicks.at(-1)![4];
    const nextTickPercentChange = ((tick[4] - prevTick) / prevTick) * 100;
    previousOutcome[0] += nextTickPercentChange;
    previousOutcome[1]++;
    outcomeMap.set(historyMasked, previousOutcome);

    previousTicks.shift();
    previousTicks.push(tick);
  }

  const sortedOutcomeMap = [...outcomeMap.entries()].sort(
    (
      [_historyA, [nextTickPercentChangeSumA, totalTicksA]],
      [_historyB, [nextTickPercentChangeSumB, totalTicksB]],
    ) => {
      const averagePercentChangeA = nextTickPercentChangeSumA / totalTicksA;
      const averagePercentChangeB = nextTickPercentChangeSumB / totalTicksB;
      return averagePercentChangeB - averagePercentChangeA;
    },
  );

  const contextMap = new Map<number, boolean>();

  let i = 0;
  let topPMaxxed = false;
  for (; i < sortedOutcomeMap.length * topP; i++) {
    const [historyMasked, [nextTickPercentChangeSum, total]] = sortedOutcomeMap[i];
    const averagePercentChange = nextTickPercentChangeSum / total;
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
