import type { AlgorithmExample } from './types';

export const NO_MONDAYS: AlgorithmExample = {
  id: 'no-mondays',
  name: 'No Mondays',
  description: 'Sell on Mondays, buy every other day. Uses the dayOfWeek helper.',
  algorithmType: 1,
  indicators: [],
  contextLength: 1,
  aggregate: '60min',
  ticker: 'SPY',
  code: {
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
  },
};
