import type { Bar, Ticker } from '@shared/api';
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

const regressionLineUserAlgorithmImplementationCodeByLanguage: Record<SupportedLanguage, string> = {
  cpp: `
#include "utils.hpp"
#include <map>
#include <string>
#include <vector>
#include <functional>

std::map<std::string, int> implementation(
    std::map<std::string, std::vector<std::vector<double>>> context,
    std::map<std::string, double> _positions,
    std::map<std::string, std::map<std::string, std::map<std::string, double>>> indicators
) {
    std::map<std::string, int> result;
    for (auto& [ticker, bars] : context) {
        auto& lr = indicators[ticker]["LinearRegression(50)"];
        double slope = lr["slope"];
        double intercept = lr["intercept"];
        auto regressionLine = [slope, intercept](int i) { return slope * i + intercept; };
        double latestPrice = bars.back()[4];
        
        if (latestPrice <= regressionLine(49)) {
            result[ticker] = Action::BUY;
        } else if (latestPrice > regressionLine(49)) {
            result[ticker] = Action::SELL;
        }
    }
    return result;
}
`,
  javascript: `
const { Action } = require('./utils.js');

function implementation(context, _positions, indicators) {
  const result = {};
  for (const ticker in context) {
    const { slope, intercept } = indicators[ticker]['LinearRegression(50)'];
    const regressionLine = (i) => slope * i + intercept;
    const latestPrice = context[ticker].at(-1)[4];

    // Buy if the latest price is below the regression line
    if (latestPrice <= regressionLine(49)) {
      result[ticker] = Action.BUY;
    } else if (latestPrice > regressionLine(49)) {
      result[ticker] = Action.SELL;
    }
  }
  return result;
}

module.exports = implementation;
`,
  python: `
from utils import Action

def implementation(context, _positions, indicators):
    result = {}
    for ticker in context:
        linear_regression = indicators[ticker]['LinearRegression(50)']
        slope = linear_regression['slope']
        intercept = linear_regression['intercept']
        regression_line = lambda i: slope * i + intercept
        latest_price = context[ticker][-1][4]

        # Buy if the latest price is below the regression line
        if latest_price <= regression_line(49):
            result[ticker] = Action.BUY
        elif latest_price > regression_line(49):
            result[ticker] = Action.SELL
    return result
`,
  typescript: `
import { Action, type Bar, type Action, type Ticker } from './utils';

export function implementation(
  context: Record<Ticker, Bar[]>,
  _positions: Record<Ticker, number>,
  indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>
): Record<Ticker, Action> {
  const result = {} as Record<Ticker, Action>;
  for (const ticker in context) {
    const { slope, intercept } = indicators[ticker]['LinearRegression(50)'];
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
}
`,
};

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
