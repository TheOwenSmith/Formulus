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
import { aboveBelowAlgorithm } from './algorithms/examples/above-below';
import {
  greenRedBarsChooseKAlgorithm,
  greenRedBarsMaskHistory,
} from './algorithms/examples/green-red-bars';
import { ifGreenAlgorithm } from './algorithms/examples/if-green';
import { overboughtOversoldAlgorithm } from './algorithms/examples/overbought-oversold';
import { chooseToPlot } from './algorithms/plot';
import { createAlgorithmFromSimpleMarketInvariantAlgorithm } from './algorithms/simple-algorithm';
import { backtestAlgorithmsConcurrently } from './backtesting/backtest-algorithms-concurrently';
import type { Ticker } from './fetch/fetch';
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
        timespan: [undefined, '2018-12-31'],
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
  // Populate algorithms with if green algorithm
  algorithms.push(
    createAlgorithmFromSimpleMarketInvariantAlgorithm(ifGreenAlgorithm, '60min', 'SPY'),
  );

  // Populate algorithms with overbought/oversold algorithm
  algorithms.push(
    createAlgorithmFromMarketInvariantAlgorithm(overboughtOversoldAlgorithm, '60min', tickers),
  );

  // Populate algorithms with above/below algorithm
  algorithms.push(
    createAlgorithmFromMarketInvariantAlgorithm(aboveBelowAlgorithm, '60min', tickers),
  );
}

console.log('Backtesting algorithms...');
const backtestResponse = await tryAsync(() =>
  backtestAlgorithmsConcurrently({
    algorithms,
    tickerData: tickers.map((ticker) => ({ ticker, aggregate: '60min', slippage: 5 })),
    timespan: ONLY_TEST_MARKET_INVARIANT_ALGORITHMS ? undefined : ['2019-01-01', undefined],
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
});
