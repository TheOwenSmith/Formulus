import { trySync } from '@/utils/errorHandling';
import { withCommas } from '@/utils/number-utils';
import fs from 'fs';
import readline from 'readline';
import z from 'zod';

export const stringifiedBarSchema = z.tuple([
  z.string(),
  z.coerce.number(),
  z.coerce.number(),
  z.coerce.number(),
  z.coerce.number(),
  z.coerce.number(),
]);

export type Bar = [t: string, o: number, h: number, l: number, c: number, v: number];

export async function getAllAggregateData(
  filename: string,
  verboseLogging = false,
): Promise<Bar[]> {
  const iter = readline
    .createInterface({
      input: fs.createReadStream(filename),
      crlfDelay: Infinity,
    })
    [Symbol.asyncIterator]();

  await iter.next(); // headers
  let current = await iter.next();

  const data: Bar[] = [];
  let lineNumber = 2;
  while (!current.done) {
    if (verboseLogging && lineNumber % 100_000 === 0) {
      console.log(`Processed ${withCommas(lineNumber)} lines...`);
    }

    const parsedLine = trySync(() => stringifiedBarSchema.parse(current.value!.split(',')));
    if (!parsedLine.ok) {
      console.error(`Error parsing line ${lineNumber}: ${current.value}`, parsedLine.error);
      throw parsedLine.error;
    }
    data.push(parsedLine.data);
    lineNumber++;
    current = await iter.next();
  }
  return data;
}

export type AggregateDataIterator = AsyncGenerator<Bar, undefined> & { close: () => void };

export function getAggregateDataIterator(
  filename: string,
  verboseLogging = false,
): AggregateDataIterator {
  if (!fs.existsSync(filename)) {
    throw new Error(`File ${filename} does not exist`);
  }

  const fileStream = fs.createReadStream(filename);
  const rlInterface = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  const iter = rlInterface[Symbol.asyncIterator]();

  async function* generator(): AsyncGenerator<Bar, undefined> {
    await iter.next(); // headers
    let current = await iter.next();

    let lineNumber = 2;
    while (!current.done) {
      if (verboseLogging && lineNumber % 100_000 === 0) {
        console.log(`Processed ${withCommas(lineNumber)} lines...`);
      }

      const parsedLine = trySync(() => stringifiedBarSchema.parse(current.value!.split(',')));
      if (!parsedLine.ok) {
        console.error(
          `Error parsing line ${withCommas(lineNumber)}: ${current.value}`,
          parsedLine.error,
        );
        throw parsedLine.error;
      }
      yield parsedLine.data;
      lineNumber++;
      current = await iter.next();
    }
    return undefined;
  }

  const gen = generator();
  return Object.assign(gen, {
    close: () => {
      rlInterface.close();
      fileStream.destroy();
    },
  });
}
