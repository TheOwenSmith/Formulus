import { Action } from '@api/core/algorithms/algorithm';
import { dayOfWeek } from '@api/core/algorithms/indicators/day-of-week';
import type { SimpleMarketInvariantAlgorithm } from '@api/core/algorithms/simple-algorithm';
import type { Bar } from '@api/fetch/types';

export const noMondaysAlgorithm: SimpleMarketInvariantAlgorithm = {
  contextLength: 1,
  implementation: async (context: Bar[]): Promise<Action> => {
    const timestamp = context[0][0];
    if (dayOfWeek(timestamp) === 'Monday') {
      return Action.SELL;
    }
    return Action.BUY;
  },
  name: 'No Mondays',
};
