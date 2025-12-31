import { Action } from '@api/core/algorithms/algorithm';
import type { SimpleMarketInvariantAlgorithm } from '@api/core/algorithms/simple-algorithm';
import type { Bar } from '@api/fetch/types';

export const ifGreenAlgorithm: SimpleMarketInvariantAlgorithm = {
  contextLength: 1,
  implementation: (context: Bar[], _position: number): Action => {
    const prevBar = context[0];
    return prevBar[4] <= prevBar[1] ? Action.BUY : Action.SELL;
  },
  name: 'If Green',
};
