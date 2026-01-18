import { Action, type MarketInvariantAlgorithm } from '@api/core/algorithms/algorithm';
import type { IndicatorResultByIndicator } from '@api/core/algorithms/indicators/indicator';
import { Direction } from '@api/core/algorithms/indicators/super-trend';
import { AlgorithmType, type UserAlgorithm } from '@api/core/algorithms/user-algorithm';
import type { SupportedLanguage } from '@api/core/backtesting/rpc/languages';
import type { Bar, Ticker } from '@api/fetch/types';
import { algorithmByLanguage } from './utils';

export const superTrendDirectionAlgorithm: MarketInvariantAlgorithm = {
  name: 'Super Trend Direction',
  contextLength: 11,
  indicators: ['SuperTrend(10,3)'],
  implementation: async (
    context: Record<Ticker, Bar[]>,
    _positions: Record<Ticker, number>,
    indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
  ): Promise<Record<Ticker, Action>> => {
    const result = {} as Record<Ticker, Action>;
    for (const ticker in context) {
      const { direction } = indicators[ticker]['SuperTrend(10,3)']!.at(-1)!;
      result[ticker] = direction === Direction.UP ? Action.BUY : Action.SELL;
    }
    return result;
  },
};

const superTrendDirectionUserAlgorithmImplementationCodeByLanguage: Record<
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
    std::map<std::string, std::map<std::string, std::vector<std::map<std::string, int>>>> indicators
) {
    std::map<std::string, int> result;
    for (auto& [ticker, bars] : context) {
        auto& st = indicators[ticker]["SuperTrend(10,3)"].back();
        int direction = st["direction"];
        result[ticker] = (direction == Direction::UP) ? Action::BUY : Action::SELL;
    }
    return result;
}
`,
  javascript: `
const { Action, Direction } = require('./utils.js');

function implementation(context, _positions, indicators) {
  const result = {};
  for (const ticker in context) {
    const { direction } = indicators[ticker]['SuperTrend(10,3)'].at(-1);
    result[ticker] = direction === Direction.UP ? Action.BUY : Action.SELL;
  }
  return result;
}

module.exports = implementation;
`,
  python: `
from utils import Action, Direction

def implementation(context, _positions, indicators):
    result = {}
    for ticker in context:
        super_trend = indicators[ticker]['SuperTrend(10,3)'][-1]
        direction = super_trend['direction']
        result[ticker] = Action.BUY if direction == Direction.UP else Action.SELL
    return result
`,
  typescript: `
import { Action, Direction, type Bar, type Ticker } from './utils';

export function implementation(
  context: Record<Ticker, Bar[]>,
  _positions: Record<Ticker, number>,
  indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>
): Record<Ticker, Action> {
  const result = {} as Record<Ticker, Action>;
  for (const ticker in context) {
    const { direction } = indicators[ticker]['SuperTrend(10,3)']!.at(-1)!;
    result[ticker] = direction === Direction.UP ? Action.BUY : Action.SELL;
  }
  return result;
}
`,
};
export const superTrendDirectionUserAlgorithmBase: Omit<
  UserAlgorithm,
  'language' | 'userAlgorithmImplementationCode'
> = {
  aggregate: '60min',
  contextLength: 11,
  indicators: ['SuperTrend(10,3)'],
  name: 'Super Trend Direction Example (User-Defined)',
  tickers: ['SPY'],
  type: AlgorithmType.NORMAL,
};

export const superTrendDirectionUserAlgorithmByLanguage: Record<SupportedLanguage, UserAlgorithm> =
  algorithmByLanguage<UserAlgorithm>(
    superTrendDirectionUserAlgorithmBase,
    superTrendDirectionUserAlgorithmImplementationCodeByLanguage,
  );
