import type { AlgorithmExample } from './types';

export const OVERBOUGHT_OVERSOLD: AlgorithmExample = {
  id: 'overbought-oversold',
  name: 'Overbought-Oversold RSI',
  description: 'Buy when RSI drops below 30 (oversold), sell when RSI exceeds 70 (overbought).',
  algorithmType: 0,
  indicators: ['RSI(14)'],
  contextLength: 15,
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
    const rsi = indicators[ticker]['RSI(14)'].at(-1);
    if (rsi < 30) {
      result[ticker] = Action.BUY;
    } else if (rsi > 70) {
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
    const rsi = indicators[ticker]['RSI(14)'].at(-1);

    if (rsi < 30) {
      result[ticker] = Action.BUY;
    } else if (rsi > 70) {
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
        rsi = indicators[ticker]['RSI(14)'][-1]

        if rsi < 30:
            result[ticker] = Action.BUY
        elif rsi > 70:
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
        double rsi = indicators[ticker]["RSI(14)"].back();
        if (rsi < 30) {
            result[ticker] = Action::BUY;
        } else if (rsi > 70) {
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
