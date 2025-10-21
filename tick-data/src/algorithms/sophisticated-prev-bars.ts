import { getAggregateDataIterator, type Bar } from '@/read-data';
import { trySync } from '@/utils/errorHandling';
import { Action, type Algorithm } from './backtest-algorithm';

export const sophisticatedPrevBarsAlgorithm = (
  contextLength: number,
  confidenceMap: Map<number, number>,
): Algorithm => ({
  name: `Sophisticated Previous Bars (${contextLength})`,
  implementation: sophisticatedPrevBarsAlgorithmImplementation(confidenceMap),
  contextLength,
});

export const sophisticatedPrevBarsAlgorithmImplementation = (
  confidenceMap: Map<number, number>,
) => {
  return function (context: Bar[], _position: number): Action {
    const historyMasked: number = maskHistory(context);
    if (confidenceMap.has(historyMasked)) {
      const chanceNextGreen = confidenceMap.get(historyMasked)!;
      if (chanceNextGreen > 0.7) return Action.BUY;
      if (chanceNextGreen < 0.3) return Action.SELL;
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

export async function createConfidenceMap(
  filename: string,
  contextLength: number,
  verboseLogging = false,
): Promise<Map<number, number>> {
  const getIteratorResponse = trySync(() => getAggregateDataIterator(filename, verboseLogging));
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

    const isGreen = tick[4] >= tick[1];
    if (isGreen) previousOutcome[0]++;

    previousOutcome[1]++;
    outcomeMap.set(historyMasked, previousOutcome);

    previousTicks.shift();
    previousTicks.push(tick);
  }

  const confidenceMap = new Map<number, number>();
  for (const [historyMasked, [wins, total]] of outcomeMap.entries()) {
    confidenceMap.set(historyMasked, wins / total);
  }
  return confidenceMap;
}
