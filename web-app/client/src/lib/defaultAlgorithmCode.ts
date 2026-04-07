/**
 * Default implementation code for new algorithms, by language and algorithm type.
 * Mirrors minimal working examples from worker (e.g. if-green, above-below-sma).
 * Keep in sync with worker expectations (utils import, export signature).
 */

import { AlgorithmType } from '@shared/api';
import type { SupportedLanguage } from '@shared/worker';

// ─── Simple (single ticker → Action) ───────────────────────────────────────

const DEFAULT_SIMPLE: Record<SupportedLanguage, string> = {
  typescript: `import { Action, type Bar, type Ticker } from './utils';

export function implementation(
  context: Bar[],
  _positions: Record<Ticker, number>,
  _indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
): Action {
  const prevBar = context[0];
  return prevBar[4] <= prevBar[1] ? Action.BUY : Action.SELL;
}
`,
  javascript: `const { Action } = require('./utils.js');

function implementation(context, _positions, _indicators) {
  const prevBar = context[0];
  return prevBar[4] <= prevBar[1] ? Action.BUY : Action.SELL;
}

module.exports = implementation;
`,
  python: `from utils import Action

def implementation(context, _positions, _indicators):
    prevBar = context[0]
    return Action.BUY if prevBar[4] <= prevBar[1] else Action.SELL
`,
  cpp: `#include "utils.hpp"
#include <map>
#include <string>
#include <vector>

std::map<std::string, int> implementation(std::vector<std::vector<double>> context) {
    auto prevBar = context[0];
    std::map<std::string, int> result;
    result["SPY"] = prevBar[4] <= prevBar[1] ? Action::BUY : Action::SELL;
    return result;
}
`,
};

// ─── Normal (multi-ticker → Record<Ticker, Action>) ────────────────────────

const DEFAULT_NORMAL: Record<SupportedLanguage, string> = {
  typescript: `import { Action, type Bar, type Ticker } from './utils';

export function implementation(
  context: Record<Ticker, Bar[]>,
  _positions: Record<Ticker, number>,
  _indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
): Record<Ticker, Action> {
  const result = {} as Record<Ticker, Action>;
  for (const ticker in context) {
    const latestClose = context[ticker].at(-1)![4];
    const prevClose = context[ticker].at(-2)![4];
    result[ticker] = latestClose >= prevClose ? Action.BUY : Action.SELL;
  }
  return result;
}
`,
  javascript: `const { Action } = require('./utils.js');

function implementation(context, _positions, _indicators) {
  const result = {};
  for (const ticker in context) {
    const bars = context[ticker];
    const latestClose = bars.at(-1)[4];
    const prevClose = bars.at(-2)[4];
    result[ticker] = latestClose >= prevClose ? Action.BUY : Action.SELL;
  }
  return result;
}

module.exports = implementation;
`,
  python: `from utils import Action

def implementation(context, _positions, _indicators):
    result = {}
    for ticker in context:
        bars = context[ticker]
        latest_close = bars[-1][4]
        prev_close = bars[-2][4]
        result[ticker] = Action.BUY if latest_close >= prev_close else Action.SELL
    return result
`,
  cpp: `#include "utils.hpp"
#include <map>
#include <string>
#include <vector>

std::map<std::string, int> implementation(
    std::map<std::string, std::vector<std::vector<double>>> context,
    std::map<std::string, double> _positions,
    std::map<std::string, std::map<std::string, std::vector<double>>> _indicators
) {
    std::map<std::string, int> result;
    for (auto& [ticker, bars] : context) {
        double latestClose = bars.back()[4];
        double prevClose = bars[bars.size() - 2][4];
        result[ticker] = latestClose >= prevClose ? Action::BUY : Action::SELL;
    }
    return result;
}
`,
};

// ─── Top-K (multi-ticker → Record<Ticker, number> scores) ───────────────────

function defaultTopKTs(tickers: string[]): string {
  const entries = tickers.map((t) => `  result['${t}'] = 0;`).join('\n');
  return `import type { Bar, Ticker } from './utils';

export function implementation(
  context: Record<Ticker, Bar[]>,
  _positions: Record<Ticker, number>,
  _indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
): Record<Ticker, number> {
  const result = {} as Record<Ticker, number>;
${entries}
  return result;
}
`;
}

function defaultTopKJs(tickers: string[]): string {
  const entries = tickers.map((t) => `  result['${t}'] = 0;`).join('\n');
  return `const { } = require('./utils.js');

function implementation(context, _positions, _indicators) {
  const result = {};
${entries}
  return result;
}

module.exports = implementation;
`;
}

function defaultTopKPy(tickers: string[]): string {
  const entries = tickers.map((t) => `    '${t}': 0`).join(',\n    ');
  return `def implementation(context, _positions, _indicators):
    return {
    ${entries}
    }
`;
}

function defaultTopKCpp(tickers: string[]): string {
  const entries = tickers.map((t) => `    result["${t}"] = 0;`).join('\n');
  return `#include "utils.hpp"
#include <map>
#include <string>
#include <vector>

std::map<std::string, double> implementation(
    std::map<std::string, std::vector<std::vector<double>>> context,
    std::map<std::string, double> _positions,
    std::map<std::string, std::map<std::string, std::vector<double>>> _indicators
) {
    std::map<std::string, double> result;
${entries}
    return result;
}
`;
}

export function getDefaultImplementationCode(
  language: SupportedLanguage,
  algorithmType: number,
  selectedTickers: string[] = [],
): string {
  if (algorithmType === AlgorithmType.SIMPLE) {
    return DEFAULT_SIMPLE[language].trimStart();
  }
  if (algorithmType === AlgorithmType.NORMAL) {
    return DEFAULT_NORMAL[language].trimStart();
  }
  if (algorithmType === AlgorithmType.TOP_K) {
    const tickers = selectedTickers.length > 0 ? selectedTickers : ['SPY'];
    switch (language) {
      case 'typescript':
        return defaultTopKTs(tickers).trimStart();
      case 'javascript':
        return defaultTopKJs(tickers).trimStart();
      case 'python':
        return defaultTopKPy(tickers).trimStart();
      case 'cpp':
        return defaultTopKCpp(tickers).trimStart();
      default:
        return defaultTopKTs(tickers).trimStart();
    }
  }
  return DEFAULT_SIMPLE[language].trimStart();
}
