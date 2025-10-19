import type { Tick } from '@/read-data';
import { Action, type Algorithm } from './backtest-algorithm';

export const d1d2Algorithm: Algorithm = {
  name: 'D1 D2 Algorithm',
  implementation: d1d2AlgorithmImplementation,
  contextLength: 3,
};

const epsilon = 0.00001;

export function d1d2AlgorithmImplementation(context: Tick[], _position: number): Action {
  const [p1, p2, p3] = context;

  const timestamp1 = Math.floor(new Date(p1[0]).getTime() / 1000);
  const timestamp2 = Math.floor(new Date(p2[0]).getTime() / 1000);
  const timestamp3 = Math.floor(new Date(p3[0]).getTime() / 1000);

  const changeP1P2AsPercentage = (p2[4] - p1[4]) / p1[4];
  const changeP2P3AsPercentage = (p3[4] - p2[4]) / p2[4];
  const d_p1_p2 = changeP1P2AsPercentage / (timestamp2 - timestamp1);
  const d_p2_p3 = changeP2P3AsPercentage / (timestamp3 - timestamp2);

  const d2 = (d_p2_p3 - d_p1_p2) / (timestamp3 - timestamp1);

  if (d_p2_p3 < epsilon) {
    return d2 > 0 ? Action.SELL : Action.BUY;
  }
  return Action.HOLD;
}
