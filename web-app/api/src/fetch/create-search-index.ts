import { trySync } from '@api/utils/errorHandling';
import fs from 'fs';
import { finished } from 'node:stream/promises';
import { tickDataCsvHeader, type Ticker, type Timestamp } from './types';

export const DATE_LENGTH = 10; // YYYY-MM-DD
export const NUMBER_LENGTH = 10; // 10 digits (works for up to 10GB files)
export const LINE_LENGTH = DATE_LENGTH + NUMBER_LENGTH;

export async function createSearchIndex(ticker: Ticker, timestamp: Timestamp): Promise<void> {
  console.log(`Creating search index for '${ticker}' (${timestamp})...`);
  const readFile = `./data/cleaned/${ticker}_${timestamp}.csv`;
  const writeToFile = `./data/index/${ticker}_${timestamp}.idx`;

  if (!fs.existsSync(readFile)) {
    throw new Error(`Failed to read from file '${readFile}' because it does not exist`);
  }

  if (!fs.existsSync('./data/index')) {
    const makeDirResponse = trySync(() => fs.mkdirSync('./data/index', { recursive: true }));
    if (!makeDirResponse.ok) throw makeDirResponse.error;
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
}
