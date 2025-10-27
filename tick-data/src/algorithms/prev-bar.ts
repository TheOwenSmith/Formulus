import { Action, type Algorithm } from './backtest-algorithm';
import type { Bar } from './read-data';

export const prevBarAlgorithm: Algorithm = {
  name: 'Previous Bar',
  implementation: prevBarAlgorithmImplementation,
  contextLength: 1,
};

export function prevBarAlgorithmImplementation(context: Bar[], _position: number): Action {
  const prevBar = context[0];
  return prevBar[4] <= prevBar[1] ? Action.BUY : Action.SELL;
}
