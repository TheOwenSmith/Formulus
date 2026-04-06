import type { Bar, Ticker } from '@shared/api';
import { REGRESSION_LINE_CODE } from '@shared/examples';
import { Action, type MarketInvariantAlgorithm } from '@worker/core/algorithms/algorithm';
import type { IndicatorResultByIndicator } from '@worker/core/algorithms/indicators/indicator';
import { AlgorithmType, type UserAlgorithm } from '@worker/core/algorithms/user-algorithm';
import type { SupportedLanguage } from '@worker/core/backtesting/rpc/languages';
import { algorithmByLanguage } from './utils';

export const regressionLineAlgorithm: MarketInvariantAlgorithm = {
  name: 'Regression Line',
  contextLength: 50,
  indicators: ['LinearRegression(50)'],
  implementation: async (
    context: Record<Ticker, Bar[]>,
    _positions: Record<Ticker, number>,
    indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
  ): Promise<Record<Ticker, Action>> => {
    const result = {} as Record<Ticker, Action>;
    for (const ticker in context) {
      const { slope, intercept } = indicators[ticker]['LinearRegression(50)']!;
      const regressionLine = (i: number) => slope * i + intercept;
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

const regressionLineUserAlgorithmImplementationCodeByLanguage = REGRESSION_LINE_CODE;

export const regressionLineUserAlgorithmBase: Omit<
  UserAlgorithm,
  'language' | 'userAlgorithmImplementationCode'
> = {
  aggregate: '60min',
  contextLength: 50,
  indicators: ['LinearRegression(50)'],
  name: 'Regression Line Example (User-Defined)',
  tickers: ['SPY'],
  type: AlgorithmType.NORMAL,
};

export const regressionLineUserAlgorithmByLanguage: Record<SupportedLanguage, UserAlgorithm> =
  algorithmByLanguage<UserAlgorithm>(
    regressionLineUserAlgorithmBase,
    regressionLineUserAlgorithmImplementationCodeByLanguage,
  );
