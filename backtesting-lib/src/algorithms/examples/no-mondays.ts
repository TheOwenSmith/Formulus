import { Action } from '@/algorithms/algorithm';
import { dayOfWeek } from '@/algorithms/indicators/day-of-week';
import type { SimpleMarketInvariantAlgorithm } from '@/algorithms/simple-algorithm';
import type { Bar } from '@/backtesting/read-data';

export const noMondaysAlgorithm: SimpleMarketInvariantAlgorithm = {
  contextLength: 1,
  implementation: (context: Bar[], _position: number): Action => {
    const timestamp = context[0][0];
    if (dayOfWeek(timestamp) === 'Monday') {
      return Action.SELL;
    }
    return Action.BUY;
  },
  name: 'No Mondays',
};
