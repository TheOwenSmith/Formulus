import type { AlgorithmExample } from './types';

export const IF_GREEN: AlgorithmExample = {
  id: 'if-green',
  name: 'If Green',
  description: 'Buy if the previous bar closed green (close >= open), sell otherwise.',
  algorithmType: 1,
  indicators: [],
  contextLength: 1,
  aggregate: '60min',
  ticker: 'SPY',
  code: {
    typescript: `
import { Action, type Bar } from './utils';

export function implementation(context: Bar[]): Action {
  // bar[1] = open, bar[4] = close
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
  },
};
