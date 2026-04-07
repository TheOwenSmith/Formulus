import type { AlgorithmExample } from './types';

export const ABOVE_BELOW_SMA: AlgorithmExample = {
  id: 'above-below-sma',
  name: 'Above-Below SMA',
  description: 'Buy when price is above the 20-period SMA, sell when below.',
  algorithmType: 0,
  indicators: ['SMA(20)'],
  contextLength: 20,
  aggregate: '60min',
  tickers: ['SPY'],
  code: {
    typescript: `
import { Action, type Bar, type Ticker } from './utils';

export function implementation(
  context: Record<Ticker, Bar[]>,
  _positions: Record<Ticker, number>,
  indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
): Record<Ticker, Action> {
  const result = {} as Record<Ticker, Action>;
  for (const ticker in context) {
    const sma = indicators[ticker]['SMA(20)'].at(-1);
    const latestPrice = context[ticker].at(-1)![4];

    if (latestPrice > sma) {
      result[ticker] = Action.BUY;
    } else if (latestPrice < sma) {
      result[ticker] = Action.SELL;
    } else {
      result[ticker] = Action.HOLD;
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
    const sma = indicators[ticker]['SMA(20)'].at(-1);
    const latestPrice = context[ticker].at(-1)[4];

    if (latestPrice > sma) {
      result[ticker] = Action.BUY;
    } else if (latestPrice < sma) {
      result[ticker] = Action.SELL;
    } else {
      result[ticker] = Action.HOLD;
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
    sma = indicators[ticker]['SMA(20)'][-1]
    latestPrice = context[ticker][-1][4]
    if latestPrice > sma:
      result[ticker] = Action.BUY
    elif latestPrice < sma:
      result[ticker] = Action.SELL
    else:
      result[ticker] = Action.HOLD
  return result
`,
    cpp: `
#include "utils.hpp"
#include <map>
#include <string>
#include <vector>

std::map<std::string, int> implementation(
    std::map<std::string, std::vector<std::vector<double>>> context,
    std::map<std::string, double> _positions,
    std::map<std::string, std::map<std::string, std::vector<double>>> indicators
) {
    std::map<std::string, int> result;
    for (auto& [ticker, bars] : context) {
        double sma = indicators[ticker]["SMA(20)"].back();
        double latestPrice = bars.back()[4];
        if (latestPrice > sma) {
            result[ticker] = Action::BUY;
        } else if (latestPrice < sma) {
            result[ticker] = Action::SELL;
        } else {
            result[ticker] = Action::HOLD;
        }
    }
    return result;
}
`,
  },
};
