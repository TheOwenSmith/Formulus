import { Action, type Algorithm } from '@/algorithms/algorithm';
import { createAlgorithmFromSimpleAlgorithm } from '@/algorithms/simple-algorithm';
import type { Bar } from '@/backtesting/read-data';
import type { Ticker, Timestamp } from '@/fetch/fetch';

export const ifGreenAlgorithm = (aggregate: Timestamp, ticker: Ticker): Algorithm =>
  createAlgorithmFromSimpleAlgorithm({
    aggregate,
    contextLength: 1,
    implementation: prevBarAlgorithmImplementation,
    name: 'If Green',
    ticker,
  });

export function prevBarAlgorithmImplementation(context: Bar[], _position: number): Action {
  const prevBar = context[0];
  return prevBar[4] <= prevBar[1] ? Action.BUY : Action.SELL;
}
