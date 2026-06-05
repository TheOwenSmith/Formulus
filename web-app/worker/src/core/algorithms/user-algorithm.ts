import type { Ticker } from '@shared/constants/trading';
import { actionSchema } from '@shared/schemas/algorithms/user-algorithm';
import { tickerSchema } from '@shared/schemas/trading';
import z from 'zod';

export const rpcUserAlgorithmResponseSchemaFromTickers = (tickers: Ticker[]) =>
  z.partialRecord(tickerSchema, actionSchema).superRefine((result, ctx) => {
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
