import { trySync } from '@api/utils/errorHandling';
import { spawnSync } from 'child_process';
import path from 'path';
import type { Ticker, Timestamp } from './types';

export function cleanData(ticker: Ticker, timestamp: Timestamp) {
  console.log(`Cleaning data for '${ticker}' (${timestamp})...`);
  const filename = `${ticker}_${timestamp}.csv`;
  const pythonScriptResponse = trySync(() =>
    spawnSync(
      'python',
      [path.join(__dirname, 'clean-data', 'clean-data.py'), filename, timestamp],
      {
        stdio: 'inherit',
      },
    ),
  );
  if (!pythonScriptResponse.ok) {
    console.error('Error running python script to clean data');
    throw pythonScriptResponse.error;
  }
}
