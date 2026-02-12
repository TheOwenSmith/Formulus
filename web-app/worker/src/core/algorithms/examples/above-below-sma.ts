import type { Bar, Ticker } from '@shared/api';
import { Action, type MarketInvariantAlgorithm } from '@worker/core/algorithms/algorithm';
import type { IndicatorResultByIndicator } from '@worker/core/algorithms/indicators/indicator';
import { AlgorithmType, type UserAlgorithm } from '@worker/core/algorithms/user-algorithm';
import { type SupportedLanguage } from '@worker/core/backtesting/rpc/languages';
import { algorithmByLanguage } from './utils';

export const aboveBelowSmaAlgorithm: MarketInvariantAlgorithm = {
  name: 'Above-Below SMA',
  contextLength: 20,
  indicators: ['SMA(20)'],
  implementation: async (
    context: Record<Ticker, Bar[]>,
    _positions: Record<Ticker, number>,
    indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
  ): Promise<Record<Ticker, Action>> => {
    const result = {} as Record<Ticker, Action>;
    for (const ticker in context) {
      const sma = indicators[ticker]['SMA(20)']!.at(-1)!;
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
  },
};

const aboveBelowSmaUserAlgorithmImplementationCodeByLanguage: Record<SupportedLanguage, string> = {
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
  typescript: `
import { Action, type Bar, type Ticker } from './utils';

export function implementation(
  context: Record<Ticker, Bar[]>,
  _positions: Record<Ticker, number>,
  indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
): Record<Ticker, Action> {
  const result = {} as Record<Ticker, Action>;
  for (const ticker in context) {
    const sma = indicators[ticker]['SMA(20)']!.at(-1)!;
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
};

const aboveBelowSmaUserAlgorithmBase: Omit<
  UserAlgorithm,
  'language' | 'userAlgorithmImplementationCode'
> = {
  aggregate: '60min',
  contextLength: 20,
  indicators: ['SMA(20)'],
  name: 'Above-Below SMA Example (User-Defined)',
  tickers: ['SPY'],
  type: AlgorithmType.NORMAL,
};

export const aboveBelowSmaUserAlgorithmByLanguage: Record<SupportedLanguage, UserAlgorithm> =
  algorithmByLanguage<UserAlgorithm>(
    aboveBelowSmaUserAlgorithmBase,
    aboveBelowSmaUserAlgorithmImplementationCodeByLanguage,
  );
