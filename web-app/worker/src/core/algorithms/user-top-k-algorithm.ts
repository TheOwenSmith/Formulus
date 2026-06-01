import type { Ticker } from '@shared/constants/trading';
import type { AnyUserAlgorithmType } from '@shared/schemas/algorithms/user-algorithm';
import type { UserTopKAlgorithm } from '@shared/schemas/algorithms/user-top-k-algorithm';
import { tickerSchema } from '@shared/schemas/trading';
import z from 'zod';
import type { Action } from './algorithm';
import type { OutputTransformer } from './pipeline';
import { scoresToActionsTopKAlgorithm } from './top-k-algorithm';

export const rpcUserTopKAlgorithmResponseSchemaFromTickers = (tickers: Ticker[]) =>
  z.partialRecord(tickerSchema, z.number()).superRefine((result, ctx) => {
    const missingTickers = new Set<Ticker>(tickers);
    for (const ticker in result) {
      const tickerWasInSet = missingTickers.delete(ticker);
      if (!tickerWasInSet) {
        ctx.addIssue({
          code: 'custom',
          input: result,
          message: `Got information for ticker '${ticker}', but it was not in list of expected tickers (${Array.from(missingTickers).join(', ')})`,
        });
      }
    }
    if (missingTickers.size > 0) {
      ctx.addIssue({
        code: 'custom',
        input: result,
        message: `Missing information for tickers (${Array.from(missingTickers).join(', ')})`,
      });
    }
  });

export const userTopKAlgorithmOutputTransformer: OutputTransformer = (
  scoreByTicker: Record<Ticker, number>,
  userAlgorithm: AnyUserAlgorithmType,
  positions: Record<Ticker, number>,
): Record<Ticker, Action> => {
  const { k } = userAlgorithm as UserTopKAlgorithm;
  return scoresToActionsTopKAlgorithm(scoreByTicker, positions, k);
};
