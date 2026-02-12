import { aboveBelowSmaUserAlgorithmByLanguage } from '@worker/core/algorithms/examples/above-below-sma';
import { ifGreenUserAlgorithmByLanguage } from '@worker/core/algorithms/examples/if-green';
import { longShortUserAlgorithmByLanguage } from '@worker/core/algorithms/examples/long-short';
import { noMondaysUserAlgorithmByLanguage } from '@worker/core/algorithms/examples/no-mondays';
import { overboughtOversoldUserAlgorithmByLanguage } from '@worker/core/algorithms/examples/overbought-oversold';
import { regressionLineUserAlgorithmByLanguage } from '@worker/core/algorithms/examples/regression-line';
import { superTrendDirectionUserAlgorithmByLanguage } from '@worker/core/algorithms/examples/super-trend-direction';
import { type AnyUserAlgorithmType } from '@worker/core/algorithms/user-algorithm';
import { backtestAlgorithmsConcurrently } from '@worker/core/backtesting/backtest-algorithms-concurrently';
import type { SupportedLanguage } from '@worker/core/backtesting/rpc/languages';
import { interactiveBrokersSlippageFunction } from '@worker/core/backtesting/slippage-functions';
import 'source-map-support/register.js';

const language: SupportedLanguage = 'cpp';
const algorithms: AnyUserAlgorithmType[] = [
  ifGreenUserAlgorithmByLanguage[language],
  aboveBelowSmaUserAlgorithmByLanguage[language],
  overboughtOversoldUserAlgorithmByLanguage[language],
  regressionLineUserAlgorithmByLanguage[language],
  noMondaysUserAlgorithmByLanguage[language],
  superTrendDirectionUserAlgorithmByLanguage[language],
  longShortUserAlgorithmByLanguage[language],
];

console.log('Backtesting algorithms...');
const backtestingResultsResponse = await backtestAlgorithmsConcurrently({
  algorithms,
  slippageMapFn: interactiveBrokersSlippageFunction,
  // timespan: ['2024-01-01', '2025-01-31'],
});
if (backtestingResultsResponse.isErr()) {
  throw backtestingResultsResponse.error;
}
