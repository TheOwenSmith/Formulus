import fs from 'fs';
import path from 'path';
import {
  backtestAlgorithmsConcurrently,
  type Strategy,
} from './algorithms/backtest-algorithms-concurrently';
import {
  createContextMap,
  deserializeContextMap,
  serializeContextMap,
  sophisticatedPrevBarsAlgorithm,
} from './algorithms/sophisticated-prev-bars';
import { secondDataFilename, tickDataFilenames } from './tick-data-files';
import { tryAsync, trySync } from './utils/errorHandling';

const constantSlippage = [0, 0.005, 0.01, 0.015, 0.02, 0.025];
const bpsSlippage = [0, 0.2, 0.5, 1, 2, 5, 10];
const contextLengths = [3]; // [3, 5, 7, 9];
const algorithms = [
  /*prevBarAlgorithm*/
];

for (const contextLength of contextLengths) {
  const contextMapFilename = `./context-maps/SPY/context-map-${contextLength}.txt`;
  if (fs.existsSync(contextMapFilename)) {
    console.log(`Loading context map from ${contextMapFilename}...`);
    const readFileResponse = trySync(() =>
      fs.readFileSync(contextMapFilename, { encoding: 'utf8' }),
    );
    if (!readFileResponse.ok) throw readFileResponse.error;
    const serializedContextMap = readFileResponse.data;

    const contextMapResponse = trySync(() => deserializeContextMap(serializedContextMap));
    if (!contextMapResponse.ok) throw contextMapResponse.error;
    const contextMap = contextMapResponse.data;

    algorithms.push(sophisticatedPrevBarsAlgorithm(contextLength, contextMap));
    continue;
  }

  const contextMap = await createContextMap({
    filename: secondDataFilename,
    contextLength,
    topP: 0.3,
    verboseLogging: true,
  });
  console.log(`Created context map for ${contextLength}`);
  algorithms.push(sophisticatedPrevBarsAlgorithm(contextLength, contextMap));

  const serializeContextMapResponse = trySync(() => serializeContextMap(contextMap));
  if (!serializeContextMapResponse.ok) throw serializeContextMapResponse.error;
  const serializedContextMap = serializeContextMapResponse.data;

  fs.mkdirSync(path.dirname(contextMapFilename), { recursive: true });
  fs.writeFileSync(contextMapFilename, serializedContextMap);
}

for (const file of tickDataFilenames) {
  const strategies: Strategy[] = [];
  for (const algorithm of algorithms) {
    const constantSlippageStrategies: Strategy[] = constantSlippage.map((slippageValue) => ({
      algorithm,
      slippage: { constant: slippageValue },
      writeToFile: `./backtest-results/SPY/${algorithm.name}/constant-slippage/$${slippageValue}.txt`,
    }));
    const bpsSlippageStrategies: Strategy[] = bpsSlippage.map((slippageValue) => ({
      algorithm,
      slippage: { bps: slippageValue },
      writeToFile: `./backtest-results/SPY/${algorithm.name}/bps-slippage/${slippageValue}bps.txt`,
      doPlot: slippageValue === 0.2,
    }));
    strategies.push(...constantSlippageStrategies, ...bpsSlippageStrategies);
  }

  const backtestResponse = await tryAsync(() =>
    backtestAlgorithmsConcurrently(file, strategies, false),
  );
  if (!backtestResponse.ok) {
    console.error(backtestResponse.error);
    continue;
  }
}
