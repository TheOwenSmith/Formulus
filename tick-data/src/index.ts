import fs from 'fs';
import type { Algorithm } from './algorithms/backtest-algorithm';
import {
  backtestAlgorithmsConcurrently,
  type Strategy,
} from './algorithms/backtest-algorithms-concurrently';
import { chooseToPlot } from './algorithms/plot';
import { prevBarAlgorithm } from './algorithms/prev-bar';
import {
  deserializeContextMap,
  sophisticatedPrevBarsAlgorithm,
} from './algorithms/sophisticated-prev-bars';
import { bearish2 } from './algorithms/timespans';
import { hourDataWithAggregateInMilliseconds } from './fetch/tick-data-files';
import type { Graph } from './lib/nodeplotlib';
import type { SelectionOption } from './utils/cli';
import { tryAsync, trySync } from './utils/errorHandling';

const contextLengths: number[] = [3, 5, 7, 9];
const bpsSlippages: number[] = [0.2, 0.5, 1];
const topPs: number[] = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
const algorithms: Algorithm[] = [prevBarAlgorithm];

for (const contextLength of contextLengths) {
  for (const topP of topPs) {
    const contextMapFilename = `./context-maps/SPY/context-map-${contextLength}-${topP * 100}%.txt`;
    if (fs.existsSync(contextMapFilename)) {
      console.log(`Loading context map from context map file ${contextMapFilename}...`);
      const readFileResponse = trySync(() =>
        fs.readFileSync(contextMapFilename, { encoding: 'utf8' }),
      );
      if (!readFileResponse.ok) throw readFileResponse.error;
      const serializedContextMap = readFileResponse.data;

      const contextMapResponse = trySync(() => deserializeContextMap(serializedContextMap));
      if (!contextMapResponse.ok) throw contextMapResponse.error;
      const contextMap = contextMapResponse.data;

      algorithms.push(
        sophisticatedPrevBarsAlgorithm(
          contextLength,
          contextMap,
          `Sophisticated Previous Bars (${contextLength}-${topP * 100}%)`,
        ),
      );
      continue;
    }

    // console.log(
    //   `Creating context map for context length ${contextLength} and top P ${topP * 100}%...`,
    // );
    // const [contextMap, topPMaxxed] = await createContextMap({
    //   filename: secondDataFilename,
    //   contextLength,
    //   topP,
    //   verboseLogging: true,
    // });
    // console.log(`Successfully created context map for context length ${contextLength}`);
    // algorithms.push(sophisticatedPrevBarsAlgorithm(contextLength, contextMap));

    // const serializeContextMapResponse = trySync(() => serializeContextMap(contextMap));
    // if (!serializeContextMapResponse.ok) throw serializeContextMapResponse.error;
    // const serializedContextMap = serializeContextMapResponse.data;

    // fs.mkdirSync(path.dirname(contextMapFilename), { recursive: true });
    // fs.writeFileSync(contextMapFilename, serializedContextMap);

    // if (topPMaxxed) break;
  }
}

console.log('Backtesting algorithms...');
const graphSelectionOptions: SelectionOption<Graph>[] = [];
for (const { filename, aggregateInMilliseconds } of [hourDataWithAggregateInMilliseconds]) {
  console.log(`Backtesting algorithms for file ${filename}...`);
  const strategies: Strategy[] = [];
  for (const algorithm of algorithms) {
    for (const bpsSlippage of bpsSlippages) {
      strategies.push({
        algorithm,
        slippage: { bps: bpsSlippage },
        alwaysHoldOutsideMarketHours: false,
        doPlot: true,
      });

      strategies.push({
        algorithm,
        slippage: { bps: bpsSlippage },
        alwaysHoldOutsideMarketHours: true,
        doPlot: true,
      });
    }
  }

  const backtestResponse = await tryAsync(() =>
    backtestAlgorithmsConcurrently({
      filename,
      aggregateInMilliseconds,
      strategies,
      timespan: bearish2,
      verboseLogging: true,
    }),
  );
  if (!backtestResponse.ok) {
    console.error(backtestResponse.error);
    continue;
  }
  const graphSelectionOptionsForFile = backtestResponse.data;
  graphSelectionOptions.push(...graphSelectionOptionsForFile);
}

graphSelectionOptions.sort((a, b) => {
  const aLastX = a.value.strategyPlot.y.at(-1) ?? 0;
  const bLastX = b.value.strategyPlot.y.at(-1) ?? 0;
  return bLastX - aLastX;
});
await chooseToPlot(graphSelectionOptions);
