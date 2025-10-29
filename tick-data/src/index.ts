import fs from 'fs';
import path from 'path';
import {
  backtestAlgorithmsConcurrently,
  type Algorithm,
} from './algorithms/backtest-algorithms-concurrently';
import { chooseToPlotByAlgorithm } from './algorithms/plot';
import { prevBarAlgorithm } from './algorithms/prev-bar';
import {
  createContextMap,
  deserializeContextMap,
  serializeContextMap,
  sophisticatedPrevBarsAlgorithm,
} from './algorithms/sophisticated-prev-bars';
import type { Graph } from './lib/nodeplotlib';
import type { SelectionOption } from './utils/cli';
import { tryAsync, trySync } from './utils/errorHandling';

const contextLengths: number[] = [3, 5, 7, 9];
const topPs: number[] = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
const algorithms: Algorithm[] = [prevBarAlgorithm];

console.log('Loading context maps...');
for (const contextLength of contextLengths) {
  for (const topP of topPs) {
    const contextMapFilename = `./context-maps/SPY/context-map-${contextLength}-${topP * 100}%.txt`;
    if (fs.existsSync(contextMapFilename)) {
      const readFileResponse = trySync(() =>
        fs.readFileSync(contextMapFilename, { encoding: 'utf8' }),
      );
      if (!readFileResponse.ok) throw readFileResponse.error;
      const serializedContextMap = readFileResponse.data;

      const contextMapResponse = trySync(() => deserializeContextMap(serializedContextMap));
      if (!contextMapResponse.ok) throw contextMapResponse.error;
      const contextMap = contextMapResponse.data;

      algorithms.push(
        sophisticatedPrevBarsAlgorithm({
          contextLength,
          contextMap,
          name: `Sophisticated Previous Bars (${contextLength}-${topP * 100}%)`,
          alwaysHoldOutsideMarketHours: false,
          doPlot: true,
        }),
        sophisticatedPrevBarsAlgorithm({
          contextLength,
          contextMap,
          name: `Sophisticated Previous Bars (${contextLength}-${topP * 100}%)`,
          alwaysHoldOutsideMarketHours: true,
          doPlot: true,
        }),
      );
      continue;
    }

    const [contextMap, topPMaxxed] = await createContextMap({
      tickDataFilename: './data/SPY_60min.csv',
      contextLength,
      topP,
      verboseLogging: true,
    });
    console.log(`Successfully created context map for context length ${contextLength}`);
    algorithms.push(
      sophisticatedPrevBarsAlgorithm({
        contextLength,
        contextMap,
        name: `Sophisticated Previous Bars (${contextLength}-${topP * 100}%)`,
        alwaysHoldOutsideMarketHours: false,
        doPlot: true,
      }),
      sophisticatedPrevBarsAlgorithm({
        contextLength,
        contextMap,
        name: `Sophisticated Previous Bars (${contextLength}-${topP * 100}%)`,
        alwaysHoldOutsideMarketHours: true,
        doPlot: true,
      }),
    );

    const serializeContextMapResponse = trySync(() => serializeContextMap(contextMap));
    if (!serializeContextMapResponse.ok) throw serializeContextMapResponse.error;
    const serializedContextMap = serializeContextMapResponse.data;

    fs.mkdirSync(path.dirname(contextMapFilename), { recursive: true });
    fs.writeFileSync(contextMapFilename, serializedContextMap);

    if (topPMaxxed) break;
  }
}

console.log('Backtesting algorithms...');
const backtestResponse = await tryAsync(() =>
  backtestAlgorithmsConcurrently({
    tickers: [
      ['SPY', './data/SPY_60min.csv', 3_600_000, { bps: 0.2 }, 0.9],
      ['SPUU', './data/SPUU_60min.csv', 3_600_000, { bps: 2 }, 0.05],
      ['SPXL', './data/SPXL_60min.csv', 3_600_000, { bps: 5 }, 0.05],
    ],
    algorithms,
    timespan: undefined,
    verboseLogging: false,
    trackProgress: true,
  }),
);
if (!backtestResponse.ok) {
  throw backtestResponse.error;
}
const graphSelectionOptionsByAlgorithm: SelectionOption<SelectionOption<Graph>[]>[] =
  backtestResponse.data;

await chooseToPlotByAlgorithm(graphSelectionOptionsByAlgorithm);
