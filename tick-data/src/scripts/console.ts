import { backtestAlgorithmsConcurrently } from '@/algorithms/backtest-algorithm';
import {
  deserializeContextMap,
  sophisticatedPrevBarsAlgorithm,
} from '@/algorithms/sophisticated-prev-bars';
import { hourDataFilename } from '@/fetch/tick-data-files';
import { tryAsync, trySync } from '@/utils/errorHandling';
import fs from 'fs';
import path from 'path';

const contextLength = 5;
const contextMapFilename = `./context-maps/SPY/context-map-${contextLength}.txt`;
console.log(`Loading context map from ${contextMapFilename}...`);
const readFileResponse = trySync(() => fs.readFileSync(contextMapFilename, { encoding: 'utf8' }));
if (!readFileResponse.ok) throw readFileResponse.error;
const serializedContextMap = readFileResponse.data;

const contextMapResponse = trySync(() => deserializeContextMap(serializedContextMap));
if (!contextMapResponse.ok) throw contextMapResponse.error;
const contextMap = contextMapResponse.data;

const algorithm = sophisticatedPrevBarsAlgorithm(contextLength, contextMap);

fs.mkdirSync(path.dirname(contextMapFilename), { recursive: true });
fs.writeFileSync(contextMapFilename, serializedContextMap);

await tryAsync(() =>
  backtestAlgorithmsConcurrently(
    hourDataFilename,
    [
      {
        algorithm: algorithm,
        slippage: { constant: 0 },
        writeToFile: `./backtest-results/SPY/${algorithm.name}/constant-slippage/$0.txt`,
        doPlot: true,
      },
    ],
    true,
  ),
);
