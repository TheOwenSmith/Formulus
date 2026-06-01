export { ABOVE_BELOW_SMA } from './above-below-sma';
export { IF_GREEN } from './if-green';
export { LONG_SHORT } from './long-short';
export { NO_MONDAYS } from './no-mondays';
export { OVERBOUGHT_OVERSOLD } from './overbought-oversold';
export { REGRESSION_LINE } from './regression-line';
export { SUPER_TREND_DIRECTION } from './super-trend-direction';
export { TOP_K_MOST_OVERSOLD } from './top-k-rsi';
export type { AlgorithmExample } from './types';

import { ABOVE_BELOW_SMA } from './above-below-sma';
import { IF_GREEN } from './if-green';
import { LONG_SHORT } from './long-short';
import { NO_MONDAYS } from './no-mondays';
import { OVERBOUGHT_OVERSOLD } from './overbought-oversold';
import { REGRESSION_LINE } from './regression-line';
import { SUPER_TREND_DIRECTION } from './super-trend-direction';
import { TOP_K_MOST_OVERSOLD } from './top-k-rsi';
import type { AlgorithmExample } from './types';

export const ALGORITHM_EXAMPLES: AlgorithmExample[] = [
  ABOVE_BELOW_SMA,
  OVERBOUGHT_OVERSOLD,
  LONG_SHORT,
  REGRESSION_LINE,
  SUPER_TREND_DIRECTION,
  IF_GREEN,
  NO_MONDAYS,
  TOP_K_MOST_OVERSOLD,
];
