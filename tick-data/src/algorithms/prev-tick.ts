import type { Tick } from '@/read-data';
import type { Action, Algorithm } from './backtest-algorithm';

export const prevTickAlgoirthm: Algorithm = {
  implementation: prevTickAlgoirthmImplementation,
  contextLength: 1,
};

export function prevTickAlgoirthmImplementation(context: Tick[], _position: number): Action {
  const prevTick = context[0];
  // return prevTick[4] <= prevTick[1] ? 'buy' : 'sell';
  return prevTick[4] <= prevTick[1] ? 'sell' : 'buy';
}
