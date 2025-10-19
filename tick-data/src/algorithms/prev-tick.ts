import type { Tick } from '@/read-data';
import { Action, type Algorithm } from './backtest-algorithm';

export const prevTickAlgorithm: Algorithm = {
  name: 'Previous Tick',
  implementation: prevTickAlgorithmImplementation,
  contextLength: 1,
};

export function prevTickAlgorithmImplementation(context: Tick[], _position: number): Action {
  const prevTick = context[0];
  return prevTick[4] <= prevTick[1] ? Action.BUY : Action.SELL;
}
