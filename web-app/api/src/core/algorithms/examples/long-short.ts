import { Action, type Algorithm } from '@api/core/algorithms/algorithm';
import type { IndicatorResultByIndicator } from '@api/core/algorithms/indicators/indicator';
import { AlgorithmType, type UserAlgorithm } from '@api/core/algorithms/user-algorithm';
import type { SupportedLanguage } from '@api/core/backtesting/rpc/languages';
import type { Bar, Ticker } from '@api/fetch/types';
import { algorithmByLanguage } from './utils';

export const longShortAlgorithm: Algorithm = {
  aggregate: '60min',
  contextLength: 15,
  implementation: async (
    _context: Record<Ticker, Bar[]>,
    positions: Record<Ticker, number>,
    indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
  ): Promise<Record<Ticker, Action>> => {
    const haveSH = positions['SH'] > 0;

    const spyRSI = indicators['SPY']['RSI(14)']!.at(-1)!;
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
  },
  indicators: ['RSI(14)'],
  name: 'Long-Short',
  tickers: ['SPY', 'SH'],
};

const longShortUserAlgorithmImplementationCodeByLanguage: Record<SupportedLanguage, string> = {
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
  typescript: `
import { Action, type Bar, type Ticker } from './utils';

export function implementation(
  context: Record<Ticker, Bar[]>,
  positions: Record<Ticker, number>,
  indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>
): Record<Ticker, Action> {
  const haveSH = positions['SH'] > 0;
  
  const spyRSI = indicators['SPY']['RSI(14)']!.at(-1)!;
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
};

export const longShortUserAlgorithmBase: Omit<
  UserAlgorithm,
  'language' | 'userAlgorithmImplementationCode'
> = {
  aggregate: '60min',
  contextLength: 20,
  indicators: ['RSI(14)'],
  name: 'Long-Short Example (User-Defined)',
  tickers: ['SPY', 'SH'],
  type: AlgorithmType.NORMAL,
};

export const longShortUserAlgorithmByLanguage: Record<SupportedLanguage, UserAlgorithm> =
  algorithmByLanguage<UserAlgorithm>(
    longShortUserAlgorithmBase,
    longShortUserAlgorithmImplementationCodeByLanguage,
  );
