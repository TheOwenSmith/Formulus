import {
  Action,
  createAlgorithmFromSimpleAlgorithm,
  type Algorithm,
} from '@/algorithms/create-simple-algorithm';
import type { Bar } from '@/backtesting/read-data';
import type { Ticker, Timestamp } from '@/fetch/fetch';

export const prevBarAlgorithm = (aggregate: Timestamp, ticker: Ticker): Algorithm =>
  createAlgorithmFromSimpleAlgorithm({
    aggregate,
    contextLength: 1,
    implementation: prevBarAlgorithmImplementation,
    name: 'Previous Bar',
    ticker,
  });

export function prevBarAlgorithmImplementation(context: Bar[], _position: number): Action {
  const prevBar = context[0];
  return prevBar[4] <= prevBar[1] ? Action.BUY : Action.SELL;
}
