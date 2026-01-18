import { aboveBelowSmaUserAlgorithmByLanguage } from '@api/core/algorithms/examples/above-below-sma';
import { ifGreenUserAlgorithmByLanguage } from '@api/core/algorithms/examples/if-green';
import { longShortUserAlgorithmByLanguage } from '@api/core/algorithms/examples/long-short';
import { noMondaysUserAlgorithmByLanguage } from '@api/core/algorithms/examples/no-mondays';
import { overboughtOversoldUserAlgorithmByLanguage } from '@api/core/algorithms/examples/overbought-oversold';
import { regressionLineUserAlgorithmByLanguage } from '@api/core/algorithms/examples/regression-line';
import { superTrendDirectionUserAlgorithmByLanguage } from '@api/core/algorithms/examples/super-trend-direction';
import { type AnyUserAlgorithmType } from '@api/core/algorithms/user-algorithm';
import { backtestAlgorithmsConcurrently } from '@api/core/backtesting/backtest-algorithms-concurrently';
import type { SupportedLanguage } from '@api/core/backtesting/rpc/languages';
import { interactiveBrokersSlippageFunction } from '@api/core/backtesting/slippage-functions';
import { tryAsync } from '@api/utils/error-handling';
import 'source-map-support/register.js';

// console.log('Uploading algorithms...');
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
// const dbAlgorithmIds: string[] = [];
// for (const algorithm of algorithms) {
//   const uploadAlgorithmResponse = await tryAsync(() =>
//     uploadAlgorithm({
//       algorithm,
//       creatorId: config.getKey('CREATOR_ID'),
//     }),
//   );
//   if (!uploadAlgorithmResponse.ok) throw uploadAlgorithmResponse.error;

//   const uploadedAlgorithmId = uploadAlgorithmResponse.data.id;
//   dbAlgorithmIds.push(uploadedAlgorithmId);
// }

console.log('Backtesting algorithms...');
const backtestResponse = await tryAsync(() =>
  backtestAlgorithmsConcurrently({
    algorithms,
    slippageMapFn: interactiveBrokersSlippageFunction,
    timespan: ['2024-01-01', '2025-01-31'],
  }),
);
if (!backtestResponse.ok) {
  throw backtestResponse.error;
}
// const backtestingResults = backtestResponse.data;

// console.log('Uploading backtesting results...');
// const uploadBacktestingResultsResponse = await tryAsync(() =>
//   uploadBacktestingResults({
//     creatorId: config.getKey('CREATOR_ID'),
//     algorithmsIds: dbAlgorithmIds,
//     result: backtestingResults,
//   }),
// );
// if (!uploadBacktestingResultsResponse.ok) throw uploadBacktestingResultsResponse.error;
// console.log('Backtesting results uploaded');
