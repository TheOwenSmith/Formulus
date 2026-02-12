import type { Bar, Ticker } from '@shared/api';
import { Action, type MarketInvariantAlgorithm } from '@worker/core/algorithms/algorithm';
import type { IndicatorResultByIndicator } from '@worker/core/algorithms/indicators/indicator';
import { AlgorithmType, type UserAlgorithm } from '@worker/core/algorithms/user-algorithm';
import type { SupportedLanguage } from '@worker/core/backtesting/rpc/languages';
import { algorithmByLanguage } from './utils';

export const overboughtOversoldAlgorithm: MarketInvariantAlgorithm = {
  name: 'Overbought-Oversold',
  contextLength: 15,
  indicators: ['RSI(14)'],
  implementation: async (
    context: Record<Ticker, Bar[]>,
    _positions: Record<Ticker, number>,
    indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
  ): Promise<Record<Ticker, Action>> => {
    const result = {} as Record<Ticker, Action>;
    for (const ticker in context) {
      const rsi = indicators[ticker]['RSI(14)']!.at(-1)!;

      if (rsi < 30) {
        result[ticker] = Action.BUY;
      } else if (rsi > 70) {
        result[ticker] = Action.SELL;
      } else {
        result[ticker] = Action.HOLD;
      }
    }
    return result;
  },
};

export const overboughtOversoldUserAlgorithmImplementationCodeByLanguage: Record<
  SupportedLanguage,
  string
> = {
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
  typescript: `
import { Action, type Bar, type Ticker } from './utils';

export function implementation(
  context: Record<Ticker, Bar[]>,
  _positions: Record<Ticker, number>,
  indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>
): Record<Ticker, Action> {
  const result = {} as Record<Ticker, Action>;
  for (const ticker in context) {
    const rsi = indicators[ticker]['RSI(14)']!.at(-1)!;
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
};

export const overboughtOversoldUserAlgorithmBase: Omit<
  UserAlgorithm,
  'language' | 'userAlgorithmImplementationCode'
> = {
  aggregate: '60min',
  contextLength: 15,
  indicators: ['RSI(14)'],
  name: 'Overbought-Oversold Example (User-Defined)',
  tickers: ['SPY'],
  type: AlgorithmType.NORMAL,
};

export const overboughtOversoldUserAlgorithmByLanguage: Record<SupportedLanguage, UserAlgorithm> =
  algorithmByLanguage<UserAlgorithm>(
    overboughtOversoldUserAlgorithmBase,
    overboughtOversoldUserAlgorithmImplementationCodeByLanguage,
  );
