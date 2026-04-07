import type { AlgorithmExample } from './types';

export const TOP_K_MOST_OVERSOLD: AlgorithmExample = {
  id: 'top-k-most_oversold',
  name: 'Top-K Most Oversold',
  description: 'Score tickers by inverted RSI. The most oversold K tickers are held.',
  algorithmType: 2,
  indicators: ['RSI(14)'],
  contextLength: 15,
  aggregate: '60min',
  tickers: ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA'],
  k: 2,
  code: {
    typescript: `
import { type Bar, type Ticker } from './utils';

// Return a score for each ticker. Higher score = higher priority to hold.
// The top K scoring tickers will be bought/held; the rest will be sold/skipped.
export function implementation(
  context: Record<Ticker, Bar[]>,
  _positions: Record<Ticker, number>,
  indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>
): Record<Ticker, number> {
  const scores: Record<Ticker, number> = {};
  for (const ticker in context) {
    const rsi = indicators[ticker]['RSI(14)'].at(-1);
    // Invert RSI: lower RSI (oversold) = higher score = higher priority to buy
    scores[ticker] = 100 - rsi;
  }
  return scores;
}
`,
    javascript: `
function implementation(context, _positions, indicators) {
  const scores = {};
  for (const ticker in context) {
    const rsi = indicators[ticker]['RSI(14)'].at(-1);
    // Invert RSI: lower RSI (oversold) = higher score = higher priority to buy
    scores[ticker] = 100 - rsi;
  }
  return scores;
}

module.exports = implementation;
`,
    python: `
def implementation(context, _positions, indicators):
    scores = {}
    for ticker in context:
        rsi = indicators[ticker]['RSI(14)'][-1]
        # Invert RSI: lower RSI (oversold) = higher score = higher priority to buy
        scores[ticker] = 100 - rsi
    return scores
`,
    cpp: `
#include "utils.hpp"
#include <map>
#include <string>
#include <vector>

std::map<std::string, double> implementation(
    std::map<std::string, std::vector<std::vector<double>>> context,
    std::map<std::string, double> _positions,
    std::map<std::string, std::map<std::string, std::vector<double>>> indicators
) {
    std::map<std::string, double> scores;
    for (auto& [ticker, bars] : context) {
        double rsi = indicators[ticker]["RSI(14)"].back();
        // Invert RSI: lower RSI (oversold) = higher score = higher priority to buy
        scores[ticker] = 100.0 - rsi;
    }
    return scores;
}
`,
  },
};
