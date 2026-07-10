import type { AlgorithmExample } from './types';

export const SUPER_TREND_DIRECTION: AlgorithmExample = {
  id: 'super-trend-direction',
  name: 'SuperTrend Direction',
  description: 'Follow the SuperTrend direction: buy when trending up, sell when trending down.',
  algorithmType: 0,
  indicators: ['SuperTrend(10,3)'],
  contextLength: 11,
  aggregate: '60min',
  tickers: ['SPY'],
  code: {
    typescript: `
import { Action, Direction, type Bar, type Ticker } from './utils';

export function implementation(
  context: Record<Ticker, Bar[]>,
  _positions: Record<Ticker, number>,
  indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>
): Record<Ticker, Action> {
  const result = {} as Record<Ticker, Action>;
  for (const ticker in context) {
    const { direction } = indicators[ticker]['SuperTrend(10,3)'].at(-1);
    result[ticker] = direction === Direction.UP ? Action.BUY : Action.SELL;
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
        st = indicators[ticker]['SuperTrend(10,3)'][-1]
        result[ticker] = Action.BUY if st['direction'] == Direction.UP else Action.SELL
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
    std::map<std::string, std::map<std::string, std::vector<std::map<std::string, int>>>> indicators
) {
    std::map<std::string, int> result;
    for (auto& [ticker, bars] : context) {
        const auto& st = indicators[ticker]["SuperTrend(10,3)"].back();
        result[ticker] = (st.at("direction") == Direction::UP) ? Action::BUY : Action::SELL;
    }
    return result;
}
`,
  },
};
