import { backtestAlgorithmsConcurrently, type Strategy } from './algorithms/backtest-algorithm';
import { d1d2Algorithm } from './algorithms/d1-d2';
import { prevBarAlgorithm } from './algorithms/prev-bar';
import { tickDataFilenames } from './tick-data-files';
import { tryAsync } from './utils/errorHandling';

const constantSlippage = [0, 0.005, 0.01, 0.015, 0.02, 0.025];
const bpsSlippage = [0, 0.2, 0.5, 1, 2, 5, 10];
const algorithms = [prevBarAlgorithm, d1d2Algorithm];

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
