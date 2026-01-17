import {
  createAlgorithmFromMarketInvariantAlgorithm,
  type Algorithm,
} from '@api/core/algorithms/algorithm';
import {
  createContextMap,
  deserializeContextMap,
  serializeContextMap,
} from '@api/core/algorithms/context-maps/context-map';
import { aboveBelowSmaAlgorithm } from '@api/core/algorithms/examples/above-below-sma';
import {
  greenRedBarsChooseKAlgorithm,
  greenRedBarsMaskHistory,
} from '@api/core/algorithms/examples/green-red-bars';
import { ifGreenAlgorithm } from '@api/core/algorithms/examples/if-green';
import { longShortAlgorithm } from '@api/core/algorithms/examples/long-short';
import { noMondaysAlgorithm } from '@api/core/algorithms/examples/no-mondays';
import { overboughtOversoldAlgorithm } from '@api/core/algorithms/examples/overbought-oversold';
import { regressionLineAlgorithm } from '@api/core/algorithms/examples/regression-line';
import { superTrendDirectionAlgorithm } from '@api/core/algorithms/examples/super-trend-direction';
import { createAlgorithmFromSimpleMarketInvariantAlgorithm } from '@api/core/algorithms/simple-algorithm';
import { uploadAlgorithm } from '@api/core/algorithms/upload-algorithm';
import { backtestAlgorithmsConcurrently } from '@api/core/backtesting/backtest-algorithms-concurrently';
import { uploadBacktestingResults } from '@api/core/backtesting/upload-backtesting-results';
import { type Ticker } from '@api/fetch/types';
import { config } from '@api/lib/config';
import { tryAsync, trySync } from '@api/utils/error-handling';
import fs from 'fs';
import path from 'path';
import z from 'zod';

// Fetch data
// const tickers: Ticker[] = [
//   'SPY',
//   'SSO',
//   'SPXL',
//   'SH',
//   'SDS',
//   'SPXU',
//   'QQQ',
//   'NVDA',
//   'TSLA',
//   'AMD',
//   'META',
//   'AAPL',
//   'MSFT',
//   'AMZN',
//   'GOOG',
//   'PLTR',
//   'SNAP',
//   'PFE',
// ];

// for (const ticker of tickers) {
//   for (const timestamp of aggregateTimestamps) {
//     await fetchAlphaVantageData({
//       ticker,
//       years: 20,
//       timestamp,
//     });
//     await cleanData(ticker, timestamp);
//     await createSearchIndex(ticker, timestamp);
//   }

//   const slippageBps = await estimateSlippageBps(ticker);
//   if (slippageBps == null) {
//     console.log(`Could not estimate slippage for ticker '${ticker}'`);
//     continue;
//   }
//   const roundedSlippageBps = roundToDecimal(slippageBps, 2);
//   fs.appendFileSync(
//     `./data/slippage.jsonl`,
//     JSON.stringify({ ticker, slippage: roundedSlippageBps }) + '\n',
//   );
// }

const algorithms: Algorithm[] = [];
const tickers: [Ticker, ...Ticker[]] = ['SPY', 'SH', 'AAPL', 'GOOG', 'PFE', 'TSLA'];
const ONLY_TEST_MARKET_INVARIANT_ALGORITHMS = true;

if (!ONLY_TEST_MARKET_INVARIANT_ALGORITHMS) {
  // Load context maps
  console.log('Loading context maps...');
  const contextLengths: number[] = [3, 5, 7, 9];
  const contextMapByTickerByContextLength = new Map<Ticker, Map<number, Map<number, number>>>();
  for (const ticker of tickers) {
    const contextMapByContextLength =
      contextMapByTickerByContextLength.get(ticker) ?? new Map<number, Map<number, number>>();

    for (const contextLength of contextLengths) {
      const contextMapFilename = `./generated/context-maps/${ticker}-${contextLength}.txt`;
      if (fs.existsSync(contextMapFilename)) {
        const readFileResponse = trySync(() =>
          fs.readFileSync(contextMapFilename, { encoding: 'utf8' }),
        );
        if (!readFileResponse.ok) throw readFileResponse.error;
        const serializedContextMap = readFileResponse.data;

        const contextMapResponse = trySync(() =>
          deserializeContextMap(serializedContextMap, z.number()),
        );
        if (!contextMapResponse.ok) throw contextMapResponse.error;
        contextMapByContextLength.set(contextLength, contextMapResponse.data);
        continue;
      }

      const contextMap = await createContextMap({
        contextLength,
        encodeContext: greenRedBarsMaskHistory,
        tickDataFilename: `./data/cleaned/${ticker}_60min.csv`,
        timespan: [null, '2018-12-31'],
        verboseLogging: false,
      });
      contextMapByContextLength.set(contextLength, contextMap);
      console.log(`Successfully created context map for context length ${contextLength}`);

      const serializeContextMapResponse = trySync(() => serializeContextMap(contextMap));
      if (!serializeContextMapResponse.ok) throw serializeContextMapResponse.error;
      const serializedContextMap = serializeContextMapResponse.data;

      fs.mkdirSync(path.dirname(contextMapFilename), { recursive: true });
      fs.writeFileSync(contextMapFilename, serializedContextMap);
    }

    contextMapByTickerByContextLength.set(ticker, contextMapByContextLength);
  }

  // Populate algorithms with green/red bars algorithms
  for (const k of [1, 2]) {
    for (const contextLength of contextLengths) {
      const contextMapByTicker = tickers.reduce(
        (acc, ticker) => {
          acc[ticker] = contextMapByTickerByContextLength.get(ticker)!.get(contextLength)!;
          return acc;
        },
        {} as Record<Ticker, Map<number, number>>,
      );

      algorithms.push(
        greenRedBarsChooseKAlgorithm({
          aggregate: '60min',
          contextLength,
          contextMapByTicker,
          k,
          tickers,
        }),
      );
    }
  }
}

if (ONLY_TEST_MARKET_INVARIANT_ALGORITHMS) {
  for (const aggregate of ['60min'] as const) {
    // Populate algorithms with if green algorithm
    algorithms.push(
      createAlgorithmFromSimpleMarketInvariantAlgorithm(ifGreenAlgorithm, aggregate, 'SPY'),
    );

    // Populate algorithms with overbought/oversold algorithm
    algorithms.push(
      createAlgorithmFromMarketInvariantAlgorithm(overboughtOversoldAlgorithm, aggregate, tickers),
    );

    // Populate algorithms with above/below SMA algorithm
    algorithms.push(
      createAlgorithmFromMarketInvariantAlgorithm(aboveBelowSmaAlgorithm, aggregate, tickers),
    );

    // Populate algorithms with long/short algorithm
    algorithms.push(longShortAlgorithm);

    // Populate algorithms with regression line algorithm
    algorithms.push(
      createAlgorithmFromMarketInvariantAlgorithm(regressionLineAlgorithm, aggregate, tickers),
    );

    // Populate algorithms with super trend direction algorithm
    algorithms.push(
      createAlgorithmFromMarketInvariantAlgorithm(superTrendDirectionAlgorithm, aggregate, tickers),
    );

    // Populate algorithms with no Mondays algorithm
    algorithms.push(
      createAlgorithmFromSimpleMarketInvariantAlgorithm(noMondaysAlgorithm, aggregate, 'SPY'),
    );
  }
}

console.log('Backtesting algorithms...');
const backtestResponse = await tryAsync(() =>
  backtestAlgorithmsConcurrently({
    algorithms,
    timespan: ONLY_TEST_MARKET_INVARIANT_ALGORITHMS ? undefined : ['2019-01-01', null],
  }),
);
if (!backtestResponse.ok) {
  throw backtestResponse.error;
}

console.log('Uploading algorithms...');
const dbAlgorithmIds: string[] = [];
for (const algorithm of algorithms) {
  const uploadAlgorithmResponse = await tryAsync(() =>
    uploadAlgorithm({
      algorithm,
      creatorId: config.getKey('CREATOR_ID'),
      userAlgorithmImplementationCode: 'console.log("Hello, world!");',
    }),
  );
  if (!uploadAlgorithmResponse.ok) throw uploadAlgorithmResponse.error;
  const dbAlgorithm = uploadAlgorithmResponse.data;
  dbAlgorithmIds.push(dbAlgorithm.id);
}

console.log('Uploading backtesting results...');
const backtestingResults = backtestResponse.data;
const uploadBacktestingResultsResponse = await tryAsync(() =>
  uploadBacktestingResults({
    creatorId: config.getKey('CREATOR_ID'),
    algorithmsIds: dbAlgorithmIds,
    result: backtestingResults,
  }),
);
if (!uploadBacktestingResultsResponse.ok) throw uploadBacktestingResultsResponse.error;
