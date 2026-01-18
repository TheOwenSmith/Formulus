import { Action } from '@api/core/algorithms/algorithm';
import type { SimpleMarketInvariantAlgorithm } from '@api/core/algorithms/simple-algorithm';
import type { Bar } from '@api/fetch/types';

export const ifGreenAlgorithm: SimpleMarketInvariantAlgorithm = {
  contextLength: 1,
  implementation: async (context: Bar[], _position: number): Promise<Action> => {
    const prevBar = context[0];
    return prevBar[4] <= prevBar[1] ? Action.BUY : Action.SELL;
  },
  name: 'If Green',
};
