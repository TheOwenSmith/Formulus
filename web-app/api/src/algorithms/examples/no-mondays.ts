import { Action } from '@api/algorithms/algorithm';
import { dayOfWeek } from '@api/algorithms/indicators/day-of-week';
import type { SimpleMarketInvariantAlgorithm } from '@api/algorithms/simple-algorithm';
import type { Bar } from '@api/backtesting/read-data';

export const noMondaysAlgorithm: SimpleMarketInvariantAlgorithm = {
  contextLength: 1,
  implementation: (context: Bar[]): Action => {
    const timestamp = context[0][0];
    if (dayOfWeek(timestamp) === 'Monday') {
      return Action.SELL;
    }
    return Action.BUY;
  },
  name: 'No Mondays',
};
