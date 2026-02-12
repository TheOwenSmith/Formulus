import type { Bar } from '@shared/api';
import { Action } from '@worker/core/algorithms/algorithm';
import { dayOfWeek } from '@worker/core/algorithms/indicators/day-of-week';
import type { IndicatorResultByIndicator } from '@worker/core/algorithms/indicators/indicator';
import type { SimpleMarketInvariantAlgorithm } from '@worker/core/algorithms/simple-algorithm';
import { AlgorithmType } from '@worker/core/algorithms/user-algorithm';
import type { UserSimpleAlgorithm } from '@worker/core/algorithms/user-simple-algorithm';
import type { SupportedLanguage } from '@worker/core/backtesting/rpc/languages';
import { algorithmByLanguage } from './utils';

export const noMondaysAlgorithm: SimpleMarketInvariantAlgorithm = {
  contextLength: 1,
  implementation: async (
    context: Bar[],
    _position: number,
    _indicators: Partial<IndicatorResultByIndicator>,
  ): Promise<Action> => {
    const timestamp = context[0][0];
    if (dayOfWeek(timestamp) === 'Monday') {
      return Action.SELL;
    }
    return Action.BUY;
  },
  name: 'No Mondays',
};

const noMondaysUserAlgorithmImplementationCodeByLanguage: Record<SupportedLanguage, string> = {
  cpp: `
#include "utils.hpp"

int implementation(std::vector<std::vector<double>> context) {
    long long timestamp = static_cast<long long>(context[0][0]);
    if (day_of_week(timestamp) == "Monday") {
        return Action::SELL;
    }
    return Action::BUY;
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
  typescript: `
import { Action, dayOfWeek, type Bar } from './utils';

export function implementation(context: Bar[]): Action {
  const timestamp = context[0][0];
  if (dayOfWeek(timestamp) === 'Monday') {
    return Action.SELL;
  }
  return Action.BUY;
}
`,
};

export const noMondaysUserAlgorithmBase: Omit<
  UserSimpleAlgorithm,
  'language' | 'userAlgorithmImplementationCode'
> = {
  aggregate: '60min',
  contextLength: 1,
  name: 'No Mondays (User-Defined)',
  ticker: 'SPY',
  type: AlgorithmType.SIMPLE,
};

export const noMondaysUserAlgorithmByLanguage: Record<SupportedLanguage, UserSimpleAlgorithm> =
  algorithmByLanguage<UserSimpleAlgorithm>(
    noMondaysUserAlgorithmBase,
    noMondaysUserAlgorithmImplementationCodeByLanguage,
  );
