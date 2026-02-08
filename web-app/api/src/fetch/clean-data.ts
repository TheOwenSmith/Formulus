import { fromThrowable, internal, type AppError } from '@api/utils/error-handling';
import { spawnSync } from 'child_process';
import { err, ok, type Result } from 'neverthrow';
import path from 'path';
import type { Ticker, Timestamp } from './types';

export function cleanData(ticker: Ticker, timestamp: Timestamp): Result<undefined, AppError> {
  console.log(`Cleaning data for '${ticker}' (${timestamp})...`);
  const filename = `${ticker}_${timestamp}.csv`;
  const pythonScriptResponse = fromThrowable(
    () =>
      spawnSync(
        'python',
        [path.join(__dirname, 'clean-data', 'clean-data.py'), filename, timestamp],
        {
          stdio: 'inherit',
        },
      ),
    (e) => internal(e, 'Error running python script to clean data'),
  );
  if (pythonScriptResponse.isErr()) {
    return err(pythonScriptResponse.error);
  }
  return ok(undefined);
}
