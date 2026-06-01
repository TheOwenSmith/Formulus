import type { AlgorithmExample } from './types';

export const REGRESSION_LINE: AlgorithmExample = {
  id: 'regression-line',
  name: 'Regression Line',
  description: 'Buy when price is below the 50-bar linear regression line; sell when above.',
  algorithmType: 0,
  indicators: ['LinearRegression(50)'],
  contextLength: 50,
  aggregate: '60min',
  tickers: ['SPY'],
  code: {
    typescript: `
import { Action, type Bar, type Ticker } from './utils';

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

    if (latestPrice <= regressionLine(49)) {
      result[ticker] = Action.BUY;
    } else {
      result[ticker] = Action.SELL;
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

    if (latestPrice <= regressionLine(49)) {
      result[ticker] = Action.BUY;
    } else {
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

        if latest_price <= regression_line(49):
            result[ticker] = Action.BUY
        else:
            result[ticker] = Action.SELL
    return result
`,
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

        result[ticker] = latestPrice <= regressionLine(49) ? Action::BUY : Action::SELL;
    }
    return result;
}
`,
  },
};
