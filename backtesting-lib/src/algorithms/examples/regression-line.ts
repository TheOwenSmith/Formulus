import { Action, type MarketInvariantAlgorithm } from '@/algorithms/algorithm';
import { linearRegression } from '@/algorithms/indicators/linear-regression';
import type { Bar } from '@/backtesting/read-data';
import type { Ticker } from '@/fetch/fetch';

export const regressionLineAlgorithm: MarketInvariantAlgorithm = {
  name: 'Regression Line',
  contextLength: 50,
  implementation: (
    context: Record<Ticker, Bar[]>,
    _positions: Record<Ticker, number>,
  ): Record<Ticker, Action> => {
    const result = {} as Record<Ticker, Action>;
    for (const ticker in context) {
      const regressionLine = linearRegression(context[ticker]);
      const latestPrice = context[ticker].at(-1)![4];

      // Buy if the latest price is below the regression line
      if (latestPrice <= regressionLine(49)) {
        result[ticker] = Action.BUY;
      } else if (latestPrice > regressionLine(49)) {
        result[ticker] = Action.SELL;
      }
    }
    return result;
  },
};
