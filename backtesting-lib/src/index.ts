import fs from 'fs';
import path from 'path';
import z from 'zod';
import {
  createAlgorithmFromMarketInvariantAlgorithm,
  type Algorithm,
} from './algorithms/algorithm';
import {
  createContextMap,
  deserializeContextMap,
  serializeContextMap,
} from './algorithms/context-maps/context-map';
import { aboveBelowSmaAlgorithm } from './algorithms/examples/above-below-sma';
import {
  greenRedBarsChooseKAlgorithm,
  greenRedBarsMaskHistory,
} from './algorithms/examples/green-red-bars';
import { ifGreenAlgorithm } from './algorithms/examples/if-green';
import { longShortAlgorithm } from './algorithms/examples/long-short';
import { overboughtOversoldAlgorithm } from './algorithms/examples/overbought-oversold';
import { regressionLineAlgorithm } from './algorithms/examples/regression-line';
import { superTrendDirectionAlgorithm } from './algorithms/examples/super-trend-direction';
import { chooseToPlot } from './algorithms/plot';
import { createAlgorithmFromSimpleMarketInvariantAlgorithm } from './algorithms/simple-algorithm';
import {
  backtestAlgorithmsConcurrently,
  type TickerData,
} from './backtesting/backtest-algorithms-concurrently';
import { aggregateTimestamps, type Ticker } from './fetch/types';
import { tryAsync, trySync } from './utils/errorHandling';

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
      const contextMapFilename = `./context-maps/${ticker}-${contextLength}.txt`;
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
  for (const aggregate of ['60min'] as const /* aggregateTimestamps */) {
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
  }
}

console.log('Backtesting algorithms...');
const backtestResponse = await tryAsync(() =>
  backtestAlgorithmsConcurrently({
    algorithms,
    tickerData: aggregateTimestamps.reduce((acc, aggregate) => {
      acc.push(...tickers.map((ticker) => ({ ticker, aggregate, slippage: 5 })));
      return acc;
    }, [] as TickerData[]),
    timespan: ONLY_TEST_MARKET_INVARIANT_ALGORITHMS ? undefined : ['2019-01-01', null],
  }),
);
if (!backtestResponse.ok) {
  throw backtestResponse.error;
}

const [algorithmGraphSelectionOptions, tickerGraphSelectionOptionsByAggregate] =
  backtestResponse.data;
await chooseToPlot(algorithmGraphSelectionOptions, tickerGraphSelectionOptionsByAggregate, {
  profitLossRatio: true,
  averageHoldingDuration: true,
  expectancyPerTrade: true,
});
