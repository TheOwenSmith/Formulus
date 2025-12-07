import { type Algorithm } from '@/algorithms/create-simple-algorithm';
import fs from 'fs';
import path from 'path';
import { chooseToPlot } from './algorithms/plot';
import { prevBarAlgorithm } from './algorithms/prev-bar';
import {
  compoundSophisticatedPrevBarsAlgorithm,
  createContextMap,
  deserializeContextMap,
  serializeContextMap,
} from './algorithms/sophisticated-prev-bars';
import { backtestAlgorithmsConcurrently } from './backtesting/backtest-algorithms-concurrently';
import type { Ticker } from './fetch/fetch';
import { tryAsync, trySync } from './utils/errorHandling';

const contextLengths: number[] = [3, 5, 7, 9];
const tickers: [Ticker, ...Ticker[]] = ['SPY', 'SH', 'AAPL', 'GOOG', 'PFE', 'TSLA'];
const algorithms: Algorithm[] = [prevBarAlgorithm('60min', 'SPY')];

console.log('Loading context maps...');
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

      const contextMapResponse = trySync(() => deserializeContextMap(serializedContextMap));
      if (!contextMapResponse.ok) throw contextMapResponse.error;
      contextMapByContextLength.set(contextLength, contextMapResponse.data);
      continue;
    }

    const contextMap = await createContextMap({
      tickDataFilename: `./data/cleaned/${ticker}_60min.csv`,
      contextLength,
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
      compoundSophisticatedPrevBarsAlgorithm({
        aggregate: '60min',
        contextLength,
        contextMapByTicker,
        k,
        tickers,
      }),
    );
  }
}

console.log('Backtesting algorithms...');
const backtestResponse = await tryAsync(() =>
  backtestAlgorithmsConcurrently({
    algorithms,
    tickerData: tickers.map((ticker) => ({ ticker, aggregate: '60min', slippage: 5 })),
    timespan: undefined, //bearish1,
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
