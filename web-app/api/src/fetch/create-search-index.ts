import { fromThrowable, internal, type AppError } from '@api/utils/error-handling';
import { DATE_LENGTH, NUMBER_LENGTH } from '@shared/search-index-constants';
import type { Timestamp } from '@shared/trading-constants';
import fs from 'fs';
import { err, ok, type Result } from 'neverthrow';
import { finished } from 'node:stream/promises';
import { tickDataCsvHeader, type Ticker } from './types';

export const enum SearchIndexType {
  START_OF_DAY,
  END_OF_DAY,
}

export async function createSearchIndex(
  ticker: Ticker,
  timestamp: Timestamp,
  type: SearchIndexType,
): Promise<Result<undefined, AppError>> {
  console.log(`Creating search index for '${ticker}' (${timestamp})...`);
  const readFile = `../worker/data/cleaned/${ticker}_${timestamp}.csv`;
  const writeToFile = `../worker/data/index/${ticker}_${timestamp}.idx`;

  if (!fs.existsSync(readFile)) {
    return err(internal(`Failed to read from file '${readFile}' because it does not exist`));
  }

  if (!fs.existsSync('../worker/data/index')) {
    const makeDirResponse = fromThrowable(
      () => fs.mkdirSync('../worker/data/index', { recursive: true }),
      (e) => internal(e),
    );
    if (makeDirResponse.isErr()) {
      return err(makeDirResponse.error);
    }
  }

  const readStream = fs.createReadStream(readFile, {
    start: Buffer.byteLength(tickDataCsvHeader),
  });
  const writeStream = fs.createWriteStream(writeToFile, { encoding: 'utf-8' });

  let previousBytes = Buffer.byteLength(tickDataCsvHeader);
  let carry = '';
  let previousDay: string = '';

  for await (const chunk of readStream as AsyncIterable<Buffer>) {
    const stringifiedChunk = chunk.toString('utf-8');
    const rawText = carry + stringifiedChunk;
    const lines = rawText.split('\n');

    // Account for carry
    let currentPositionBytes = previousBytes - Buffer.byteLength(carry);
    carry = lines.pop() ?? '';

    for (const line of lines) {
      if (line !== '') {
        const day = line.slice(0, DATE_LENGTH);
        if (day !== previousDay) {
          const currentPositionBytesString = currentPositionBytes
            .toString()
            .padStart(NUMBER_LENGTH, '0');
          writeStream.write(`${day}${currentPositionBytesString}`);
          previousDay = day;
        }
      }
      currentPositionBytes += Buffer.byteLength(line) + 1;
    }

    previousBytes += chunk.length;
  }

  // Handle last line
  if (carry !== '') {
    const currentPositionBytes = previousBytes - Buffer.byteLength(carry);
    const day = carry.slice(0, DATE_LENGTH);
    if (day !== previousDay) {
      const currentPositionBytesString = currentPositionBytes
        .toString()
        .padStart(NUMBER_LENGTH, '0');
      writeStream.write(`${day}${currentPositionBytesString}`);
    }
  }

  writeStream.end();
  await finished(writeStream);
  console.log(`Successfully created search index for '${ticker}' (${timestamp})`);
  return ok(undefined);
}
