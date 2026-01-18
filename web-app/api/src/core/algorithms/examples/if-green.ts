import { Action } from '@api/core/algorithms/algorithm';
import type { IndicatorResultByIndicator } from '@api/core/algorithms/indicators/indicator';
import type { SimpleMarketInvariantAlgorithm } from '@api/core/algorithms/simple-algorithm';
import { AlgorithmType } from '@api/core/algorithms/user-algorithm';
import type { UserSimpleAlgorithm } from '@api/core/algorithms/user-simple-algorithm';
import { type SupportedLanguage } from '@api/core/backtesting/rpc/languages';
import type { Bar } from '@api/fetch/types';
import { algorithmByLanguage } from './utils';

export const ifGreenAlgorithm: SimpleMarketInvariantAlgorithm = {
  contextLength: 1,
  implementation: async (
    context: Bar[],
    _position: number,
    _indicators: Partial<IndicatorResultByIndicator>,
  ): Promise<Action> => {
    const prevBar = context[0];
    return prevBar[4] <= prevBar[1] ? Action.BUY : Action.SELL;
  },
  name: 'If Green',
};

const ifGreenUserAlgorithmImplementationCodeByLanguage: Record<SupportedLanguage, string> = {
  cpp: `
#include "utils.hpp"
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
  javascript: `
const { Action } = require('./utils.js');

function implementation(context, _positions, _indicators) {
  const prevBar = context[0];
  return prevBar[4] <= prevBar[1] ? Action.BUY : Action.SELL;
}

module.exports = implementation;
`,
  python: `
from utils import Action

def implementation(context, _positions, _indicators):
    prevBar = context[0]
    return Action.BUY if prevBar[4] <= prevBar[1] else Action.SELL
`,
  typescript: `
import { Action, type Bar, type Ticker } from './utils';

export function implementation(
  context: Bar[],
  _positions: Record<Ticker, number>,
  _indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
): Action {
  const prevBar = context[0];
  return prevBar[4] <= prevBar[1] ? Action.BUY : Action.SELL;
}
`,
};

const ifGreenUserAlgorithmBase: Omit<
  UserSimpleAlgorithm,
  'language' | 'userAlgorithmImplementationCode'
> = {
  aggregate: '60min',
  contextLength: 1,
  name: 'If Green (User-Defined)',
  ticker: 'SPY',
  type: AlgorithmType.SIMPLE,
};

export const ifGreenUserAlgorithmByLanguage: Record<SupportedLanguage, UserSimpleAlgorithm> =
  algorithmByLanguage<UserSimpleAlgorithm>(
    ifGreenUserAlgorithmBase,
    ifGreenUserAlgorithmImplementationCodeByLanguage,
  );
