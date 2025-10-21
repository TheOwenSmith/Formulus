import fs from 'fs';
import path from 'path';
import { backtestAlgorithmsConcurrently, type Strategy } from './algorithms/backtest-algorithm';
import { prevBarAlgorithm } from './algorithms/prev-bar';
import {
  createConfidenceMap,
  sophisticatedPrevBarsAlgorithm,
} from './algorithms/sophisticated-prev-bars';
import { secondDataFilename, tickDataFilenames } from './tick-data-files';
import { tryAsync } from './utils/errorHandling';

const constantSlippage = [0, 0.005, 0.01, 0.015, 0.02, 0.025];
const bpsSlippage = [0, 0.2, 0.5, 1, 2, 5, 10];
const algorithms = [prevBarAlgorithm];

for (const contextLength of [3, 5, 7, 9]) {
  const contextMap = await createConfidenceMap(secondDataFilename, contextLength, true);
  algorithms.push(sophisticatedPrevBarsAlgorithm(contextLength, contextMap));

  const serializedContextMap = JSON.stringify(Array.from(contextMap));
  const filename = `./context-maps/SPY/context-map-${contextLength}.txt`;
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, serializedContextMap);
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
    }));
    strategies.push(...constantSlippageStrategies, ...bpsSlippageStrategies);
  }

  const backtestResponse = await tryAsync(() =>
    backtestAlgorithmsConcurrently(file, strategies, true),
  );
  if (!backtestResponse.ok) {
    console.error(backtestResponse.error);
    continue;
  }
}
