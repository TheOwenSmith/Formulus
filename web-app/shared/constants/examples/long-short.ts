import type { AlgorithmExample } from './types';

export const LONG_SHORT: AlgorithmExample = {
  id: 'long-short',
  name: 'Long-Short (SPY-SH)',
  description: 'Uses RSI on SPY to switch between the market (SPY) and its inverse ETF (SH).',
  algorithmType: 0,
  indicators: ['RSI(14)'],
  contextLength: 15,
  aggregate: '60min',
  tickers: ['SPY', 'SH'],
  code: {
    typescript: `
import { Action, type Bar, type Ticker } from './utils';

export function implementation(
  context: Record<Ticker, Bar[]>,
  positions: Record<Ticker, number>,
  indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>
): Record<Ticker, Action> {
  const haveSH = positions['SH'] > 0;

  const spyRSI = indicators['SPY']['RSI(14)'].at(-1);
  if (spyRSI < 25) {
    return { SPY: Action.BUY, SH: Action.SELL } as Record<Ticker, Action>;
  }

  if (haveSH) {
    if (spyRSI < 50) {
      return { SPY: Action.HOLD, SH: Action.SELL } as Record<Ticker, Action>;
    } else {
      return { SPY: Action.HOLD, SH: Action.HOLD } as Record<Ticker, Action>;
    }
  }

  if (spyRSI > 85) {
    return { SPY: Action.SELL, SH: Action.BUY } as Record<Ticker, Action>;
  } else if (spyRSI > 75) {
    return { SPY: Action.SELL, SH: Action.HOLD } as Record<Ticker, Action>;
  }

  return { SPY: Action.HOLD, SH: Action.HOLD } as Record<Ticker, Action>;
}
`,
    javascript: `
const { Action } = require('./utils.js');

function implementation(context, positions, indicators) {
  const haveSH = positions['SH'] > 0;

  const spyRSI = indicators['SPY']['RSI(14)'].at(-1);
  if (spyRSI < 25) {
    return { SPY: Action.BUY, SH: Action.SELL };
  }

  if (haveSH) {
    if (spyRSI < 50) {
      return { SPY: Action.HOLD, SH: Action.SELL };
    } else {
      return { SPY: Action.HOLD, SH: Action.HOLD };
    }
  }

  if (spyRSI > 85) {
    return { SPY: Action.SELL, SH: Action.BUY };
  } else if (spyRSI > 75) {
    return { SPY: Action.SELL, SH: Action.HOLD };
  }

  return { SPY: Action.HOLD, SH: Action.HOLD };
}

module.exports = implementation;
`,
    python: `
from utils import Action

def implementation(context, positions, indicators):
    have_sh = positions['SH'] > 0

    spy_rsi = indicators['SPY']['RSI(14)'][-1]
    if spy_rsi < 25:
        return {'SPY': Action.BUY, 'SH': Action.SELL}

    if have_sh:
        if spy_rsi < 50:
            return {'SPY': Action.HOLD, 'SH': Action.SELL}
        else:
            return {'SPY': Action.HOLD, 'SH': Action.HOLD}

    if spy_rsi > 85:
        return {'SPY': Action.SELL, 'SH': Action.BUY}
    elif spy_rsi > 75:
        return {'SPY': Action.SELL, 'SH': Action.HOLD}

    return {'SPY': Action.HOLD, 'SH': Action.HOLD}
`,
    cpp: `
#include "utils.hpp"
#include <map>
#include <string>

std::map<std::string, int> implementation(
    std::map<std::string, std::vector<std::vector<double>>> context,
    std::map<std::string, double> positions,
    std::map<std::string, std::map<std::string, std::vector<double>>> indicators
) {
    bool haveSH = positions["SH"] > 0;
    double spyRSI = indicators["SPY"]["RSI(14)"].back();

    if (spyRSI < 25) {
        return {{"SPY", Action::BUY}, {"SH", Action::SELL}};
    }

    if (haveSH) {
        if (spyRSI < 50) {
            return {{"SPY", Action::HOLD}, {"SH", Action::SELL}};
        } else {
            return {{"SPY", Action::HOLD}, {"SH", Action::HOLD}};
        }
    }

    if (spyRSI > 85) {
        return {{"SPY", Action::SELL}, {"SH", Action::BUY}};
    } else if (spyRSI > 75) {
        return {{"SPY", Action::SELL}, {"SH", Action::HOLD}};
    }

    return {{"SPY", Action::HOLD}, {"SH", Action::HOLD}};
}
`,
  },
};
