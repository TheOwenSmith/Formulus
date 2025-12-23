import { Action, type MarketInvariantAlgorithm } from '@/algorithms/algorithm';
import type { IndicatorMetadata } from '@/algorithms/indicators/indicator-metadata';
import { computeLinearRegression } from '@/algorithms/indicators/linear-regression';
import type { Bar } from '@/backtesting/read-data';
import type { Ticker } from '@/fetch/types';

export const regressionLineAlgorithm: MarketInvariantAlgorithm = {
  name: 'Regression Line',
  contextLength: 50,
  implementation: (
    context: Record<Ticker, Bar[]>,
    _positions: Record<Ticker, number>,
    metadata: Record<Ticker, IndicatorMetadata>,
  ): Record<Ticker, Action> => {
    const result = {} as Record<Ticker, Action>;
    for (const ticker in context) {
      const regressionLine = computeLinearRegression({
        bars: context[ticker],
        period: 50,
        metadata: metadata[ticker],
      });
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
