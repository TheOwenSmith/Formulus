import { stringifiedBarSchema, type Bar } from '@api/fetch/types';
import { trySync } from '@api/utils/errorHandling';
import { withCommas } from '@api/utils/number-utils';
import fs from 'fs';
import readline from 'readline';

const LINES_PROGRESS_UPDATE_INTERVAL = 1_000_000;

export type AggregateDataIterator = AsyncGenerator<{ bar: Bar; bytesProcessed: number }, null> & {
  close: () => void;
};

export function getAggregateDataIterator({
  endByte,
  filename,
  parseStrictly,
  startByte,
  verboseLogging = false,
}: {
  endByte?: number;
  filename: string;
  parseStrictly: boolean;
  startByte?: number;
  verboseLogging?: boolean;
}): AggregateDataIterator {
  if (!fs.existsSync(filename)) {
    throw new Error(`File '${filename}' does not exist`);
  }

  const fileStream = fs.createReadStream(filename, {
    ...(startByte != undefined ? { start: startByte } : {}),
    ...(endByte != undefined ? { end: endByte } : {}),
  });
  const rlInterface = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  const iter = rlInterface[Symbol.asyncIterator]();

  async function* generator(): AsyncGenerator<{ bar: Bar; bytesProcessed: number }, null> {
    let current = await iter.next();

    let linesProcessed = 0;
    while (!current.done) {
      if (verboseLogging && ++linesProcessed % LINES_PROGRESS_UPDATE_INTERVAL === 0) {
        console.log(`Processed ${withCommas(linesProcessed)} lines...`);
      }

      const stringifiedLine = current.value!;
      // Account for \r\n, but not for the first line
      const bytesProcessed = Buffer.byteLength(stringifiedLine) + (linesProcessed > 1 ? 2 : 0);

      if (parseStrictly) {
        const parsedLine = trySync(() => stringifiedBarSchema.parse(stringifiedLine.split(',')));
        if (!parsedLine.ok) {
          console.error(
            `Error parsing file '${filename}' line '${stringifiedLine}'`,
            parsedLine.error,
          );
          throw parsedLine.error;
        }
        const bar = parsedLine.data;
        yield { bar, bytesProcessed };
      } else {
        const split = stringifiedLine.split(',');
        const bar = [split[0], ...split.slice(1, 6).map(Number)] as Bar;
        yield { bar, bytesProcessed };
      }

      current = await iter.next();
    }
    return null;
  }

  const gen = generator();
  return Object.assign(gen, {
    close: () => {
      rlInterface.close();
      fileStream.destroy();
    },
  });
}
