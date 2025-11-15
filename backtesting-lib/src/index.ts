import fs from 'fs';
import path from 'path';
import { chooseToPlotByAlgorithm } from './algorithms/plot';
import { prevBarAlgorithm } from './algorithms/prev-bar';
import {
  createContextMap,
  deserializeContextMap,
  serializeContextMap,
  sophisticatedPrevBarsAlgorithm,
} from './algorithms/sophisticated-prev-bars';
import {
  backtestAlgorithmsConcurrently,
  OutsideMarketHoursAction,
  type Algorithm,
} from './backtesting/backtest-algorithms-concurrently';
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

      for (const outsideMarketHours of [
        OutsideMarketHoursAction.ALWAYS_BUY,
        OutsideMarketHoursAction.ALWAYS_SELL,
        OutsideMarketHoursAction.MAINTAIN_POSITION,
      ]) {
        algorithms.push(
          sophisticatedPrevBarsAlgorithm({
            contextLength,
            contextMap,
            doPlot: true,
            name: `Sophisticated Previous Bars (${contextLength}-${topP * 100}%)`,
            outsideMarketHours,
          }),
        );
      }
      continue;
    }

    const [contextMap, topPMaxxed] = await createContextMap({
      tickDataFilename: './data/SPY_60min.csv',
      contextLength,
      topP,
      verboseLogging: true,
    });
    console.log(`Successfully created context map for context length ${contextLength}`);
    for (const outsideMarketHours of [
      OutsideMarketHoursAction.ALWAYS_BUY,
      OutsideMarketHoursAction.ALWAYS_SELL,
      OutsideMarketHoursAction.MAINTAIN_POSITION,
    ]) {
      algorithms.push(
        sophisticatedPrevBarsAlgorithm({
          contextLength,
          contextMap,
          doPlot: true,
          name: `Sophisticated Previous Bars (${contextLength}-${topP * 100}%)`,
          outsideMarketHours,
        }),
      );
    }

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
    algorithms,
    tickers: [
      ['SPY', '60min', { bps: 0.2 }, 0.9],
      ['SPUU', '60min', { bps: 2 }, 0.05],
      ['SPXL', '60min', { bps: 5 }, 0.05],
    ],
    timespan: undefined,
    trackProgress: true,
    verboseLogging: false,
  }),
);
if (!backtestResponse.ok) {
  throw backtestResponse.error;
}
const graphSelectionOptionsByAlgorithm: SelectionOption<SelectionOption<Graph>[]>[] =
  backtestResponse.data;

await chooseToPlotByAlgorithm(graphSelectionOptionsByAlgorithm);
