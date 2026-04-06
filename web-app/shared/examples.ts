import type { SupportedLanguage } from './trading-constants';

export type AlgorithmExample = {
  id: string;
  name: string;
  description: string;
  /** 0 = Normal, 1 = Simple, 2 = Top-K */
  algorithmType: 0 | 1 | 2;
  indicators: string[];
  contextLength: number;
  aggregate: string;
  tickers?: string[];
  ticker?: string;
  k?: number;
  code: Record<SupportedLanguage, string>;
};

// ─── Normal algorithm examples ────────────────────────────────────────────────

export const ABOVE_BELOW_SMA_CODE: Record<SupportedLanguage, string> = {
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
};

export const OVERBOUGHT_OVERSOLD_CODE: Record<SupportedLanguage, string> = {
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
};

export const LONG_SHORT_CODE: Record<SupportedLanguage, string> = {
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
};

export const REGRESSION_LINE_CODE: Record<SupportedLanguage, string> = {
  typescript: `
import { Action, type Bar, type Ticker } from './utils';

export function implementation(
  context: Record<Ticker, Bar[]>,
  _positions: Record<Ticker, number>,
  indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>
): Record<Ticker, Action> {
  const result = {} as Record<Ticker, Action>;
  for (const ticker in context) {
    const { slope, intercept } = indicators[ticker]['LinearRegression(50)']!;
    const regressionLine = (i: number) => slope * i + intercept;
    const latestPrice = context[ticker].at(-1)![4];

    // Buy if the latest price is below the regression line
    if (latestPrice <= regressionLine(49)) {
      result[ticker] = Action.BUY;
    } else if (latestPrice > regressionLine(49)) {
      result[ticker] = Action.SELL;
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
    const { slope, intercept } = indicators[ticker]['LinearRegression(50)'];
    const regressionLine = (i) => slope * i + intercept;
    const latestPrice = context[ticker].at(-1)[4];

    // Buy if the latest price is below the regression line
    if (latestPrice <= regressionLine(49)) {
      result[ticker] = Action.BUY;
    } else if (latestPrice > regressionLine(49)) {
      result[ticker] = Action.SELL;
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
        linear_regression = indicators[ticker]['LinearRegression(50)']
        slope = linear_regression['slope']
        intercept = linear_regression['intercept']
        regression_line = lambda i: slope * i + intercept
        latest_price = context[ticker][-1][4]

        # Buy if the latest price is below the regression line
        if latest_price <= regression_line(49):
            result[ticker] = Action.BUY
        elif latest_price > regression_line(49):
            result[ticker] = Action.SELL
    return result
`,
  cpp: `
#include "utils.hpp"
#include <map>
#include <string>
#include <vector>
#include <functional>

std::map<std::string, int> implementation(
    std::map<std::string, std::vector<std::vector<double>>> context,
    std::map<std::string, double> _positions,
    std::map<std::string, std::map<std::string, std::map<std::string, double>>> indicators
) {
    std::map<std::string, int> result;
    for (auto& [ticker, bars] : context) {
        auto& lr = indicators[ticker]["LinearRegression(50)"];
        double slope = lr["slope"];
        double intercept = lr["intercept"];
        auto regressionLine = [slope, intercept](int i) { return slope * i + intercept; };
        double latestPrice = bars.back()[4];

        if (latestPrice <= regressionLine(49)) {
            result[ticker] = Action::BUY;
        } else if (latestPrice > regressionLine(49)) {
            result[ticker] = Action::SELL;
        }
    }
    return result;
}
`,
};

export const SUPER_TREND_DIRECTION_CODE: Record<SupportedLanguage, string> = {
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
};

// ─── Simple algorithm examples ────────────────────────────────────────────────

export const IF_GREEN_CODE: Record<SupportedLanguage, string> = {
  typescript: `
import { Action, type Bar } from './utils';

export function implementation(context: Bar[]): Action {
  // bar[1] = open, bar[4] = close
  // Previous bar is green if close >= open
  const prevBar = context[0];
  return prevBar[4] >= prevBar[1] ? Action.BUY : Action.SELL;
}
`,
  javascript: `
const { Action } = require('./utils.js');

function implementation(context, _positions, _indicators) {
  const prevBar = context[0];
  return prevBar[4] >= prevBar[1] ? Action.BUY : Action.SELL;
}

module.exports = implementation;
`,
  python: `
from utils import Action

def implementation(context, _positions, _indicators):
    prevBar = context[0]
    return Action.BUY if prevBar[4] >= prevBar[1] else Action.SELL
`,
  cpp: `
#include "utils.hpp"
#include <vector>

int implementation(std::vector<std::vector<double>> context) {
    auto prevBar = context[0];
    return prevBar[4] >= prevBar[1] ? Action::BUY : Action::SELL;
}
`,
};

export const NO_MONDAYS_CODE: Record<SupportedLanguage, string> = {
  typescript: `
import { Action, dayOfWeek, type Bar } from './utils';

export function implementation(context: Bar[]): Action {
  // bar[0] is the timestamp string
  const timestamp = context[0][0];
  if (dayOfWeek(timestamp) === 'Monday') {
    return Action.SELL;
  }
  return Action.BUY;
}
`,
  javascript: `
const { Action, dayOfWeek } = require('./utils.js');

function implementation(context, _positions, _indicators) {
  const timestamp = context[0][0];
  if (dayOfWeek(timestamp) === 'Monday') {
    return Action.SELL;
  }
  return Action.BUY;
}

module.exports = implementation;
`,
  python: `
from utils import Action, day_of_week

def implementation(context, _positions, _indicators):
    timestamp = context[0][0]
    if day_of_week(timestamp) == 'Monday':
      return Action.SELL
    return Action.BUY
`,
  cpp: `
#include "utils.hpp"
#include <string>
#include <vector>

int implementation(std::vector<std::vector<double>> context) {
    long long timestamp = static_cast<long long>(context[0][0]);
    if (day_of_week(timestamp) == "Monday") {
        return Action::SELL;
    }
    return Action::BUY;
}
`,
};

// ─── Top-K algorithm examples ─────────────────────────────────────────────────

export const TOP_K_RSI_CODE: Record<SupportedLanguage, string> = {
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
    const rsi = indicators[ticker]['RSI(14)']?.at(-1) ?? 50;
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
    const rsi = indicators[ticker]['RSI(14)']?.at(-1) ?? 50;
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
        rsi_values = indicators[ticker].get('RSI(14)', [])
        rsi = rsi_values[-1] if rsi_values else 50
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
};

// ─── Example registry ─────────────────────────────────────────────────────────

export const ALGORITHM_EXAMPLES: AlgorithmExample[] = [
  {
    id: 'above-below-sma',
    name: 'Above-Below SMA',
    description: 'Buy when price is above the 20-period SMA, sell when below.',
    algorithmType: 0,
    indicators: ['SMA(20)'],
    contextLength: 20,
    aggregate: '60min',
    tickers: ['SPY'],
    code: ABOVE_BELOW_SMA_CODE,
  },
  {
    id: 'overbought-oversold',
    name: 'Overbought-Oversold RSI',
    description: 'Buy when RSI drops below 30 (oversold), sell when RSI exceeds 70 (overbought).',
    algorithmType: 0,
    indicators: ['RSI(14)'],
    contextLength: 15,
    aggregate: '60min',
    tickers: ['SPY'],
    code: OVERBOUGHT_OVERSOLD_CODE,
  },
  {
    id: 'long-short',
    name: 'Long-Short (SPY / SH)',
    description: 'Uses RSI on SPY to switch between the market (SPY) and its inverse ETF (SH).',
    algorithmType: 0,
    indicators: ['RSI(14)'],
    contextLength: 15,
    aggregate: '60min',
    tickers: ['SPY', 'SH'],
    code: LONG_SHORT_CODE,
  },
  {
    id: 'regression-line',
    name: 'Regression Line',
    description: 'Buy when price is below the 50-bar linear regression line; sell when above.',
    algorithmType: 0,
    indicators: ['LinearRegression(50)'],
    contextLength: 50,
    aggregate: '60min',
    tickers: ['SPY'],
    code: REGRESSION_LINE_CODE,
  },
  {
    id: 'super-trend-direction',
    name: 'SuperTrend Direction',
    description: 'Follow the SuperTrend direction: buy when trending up, sell when trending down.',
    algorithmType: 0,
    indicators: ['SuperTrend(10,3)'],
    contextLength: 11,
    aggregate: '60min',
    tickers: ['SPY'],
    code: SUPER_TREND_DIRECTION_CODE,
  },
  {
    id: 'if-green',
    name: 'If Green',
    description: 'Buy if the previous bar closed green (close >= open), sell otherwise.',
    algorithmType: 1,
    indicators: [],
    contextLength: 1,
    aggregate: '60min',
    ticker: 'SPY',
    code: IF_GREEN_CODE,
  },
  {
    id: 'no-mondays',
    name: 'No Mondays',
    description: 'Sell on Mondays, buy every other day. Uses the dayOfWeek helper.',
    algorithmType: 1,
    indicators: [],
    contextLength: 1,
    aggregate: '60min',
    ticker: 'SPY',
    code: NO_MONDAYS_CODE,
  },
  {
    id: 'top-k-rsi',
    name: 'Top-K RSI (Most Oversold)',
    description: 'Score tickers by inverted RSI. The most oversold K tickers are held.',
    algorithmType: 2,
    indicators: ['RSI(14)'],
    contextLength: 15,
    aggregate: '60min',
    tickers: ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA'],
    k: 2,
    code: TOP_K_RSI_CODE,
  },
];
