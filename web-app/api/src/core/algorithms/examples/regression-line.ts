import { Action, type MarketInvariantAlgorithm } from '@api/core/algorithms/algorithm';
import type { IndicatorResultByIndicator } from '@api/core/algorithms/indicators/indicator';
import type { Bar, Ticker } from '@api/fetch/types';

export const regressionLineAlgorithm: MarketInvariantAlgorithm = {
  name: 'Regression Line',
  contextLength: 50,
  indicators: ['LinearRegression(50)'],
  implementation: (
    context: Record<Ticker, Bar[]>,
    _positions: Record<Ticker, number>,
    indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
  ): Record<Ticker, Action> => {
    const result = {} as Record<Ticker, Action>;
    for (const ticker in context) {
      const regressionLine = indicators[ticker]['LinearRegression(50)']!;
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
