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

export const stringifiedOptimizedBarSchema = z.tuple([
  z.string(),
  z.coerce.number(),
  z.coerce.number(),
  z.coerce.number(),
  z.coerce.number(),
  z.coerce.number(),
  z.coerce.boolean(),
]);

export type Bar = [t: string, o: number, h: number, l: number, c: number, v: number];
export type OptimizedBar = [
  t: string,
  o: number,
  h: number,
  l: number,
  c: number,
  v: number,
  marketOpen: boolean,
];

export function getAllAggregateData(
  filename: string,
  isOptimized: false,
  verboseLogging?: boolean,
): Promise<Bar[]>;
export function getAllAggregateData(
  filename: string,
  isOptimized: true,
  verboseLogging?: boolean,
): Promise<OptimizedBar[]>;
export function getAllAggregateData(
  filename: string,
  isOptimized: boolean,
  verboseLogging?: boolean,
): Promise<(Bar | OptimizedBar)[]>;

export async function getAllAggregateData(
  filename: string,
  isOptimized: boolean,
  verboseLogging = false,
): Promise<(Bar | OptimizedBar)[]> {
  const iter = readline
    .createInterface({
      input: fs.createReadStream(filename),
      crlfDelay: Infinity,
    })
    [Symbol.asyncIterator]();

  await iter.next(); // headers
  let current = await iter.next();

  const data: (Bar | OptimizedBar)[] = [];
  let lineNumber = 1;
  while (!current.done) {
    if (verboseLogging && lineNumber % 100_000 === 0) {
      console.log(`Processed ${withCommas(lineNumber)} lines...`);
    }

    const parsedLine = trySync(() => {
      if (!isOptimized) {
        return stringifiedBarSchema.parse(current.value!.split(','));
      } else {
        return stringifiedOptimizedBarSchema.parse(current.value!.split(','));
      }
    });
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

export function getAggregateDataIterator(
  filename: string,
  isOptimized: false,
  verboseLogging?: boolean,
): AsyncGenerator<Bar, undefined>;
export function getAggregateDataIterator(
  filename: string,
  isOptimized: true,
  verboseLogging?: boolean,
): AsyncGenerator<OptimizedBar, undefined>;
export function getAggregateDataIterator(
  filename: string,
  isOptimized: boolean,
  verboseLogging?: boolean,
): AsyncGenerator<Bar | OptimizedBar, undefined>;

export async function* getAggregateDataIterator(
  filename: string,
  isOptimized: boolean,
  verboseLogging = false,
): AsyncGenerator<Bar | OptimizedBar, undefined> {
  if (!fs.existsSync(filename)) {
    throw new Error(`File ${filename} does not exist`);
  }

  const iter = readline
    .createInterface({
      input: fs.createReadStream(filename),
      crlfDelay: Infinity,
    })
    [Symbol.asyncIterator]();

  await iter.next(); // headers
  let current = await iter.next();

  let lineNumber = 1;
  while (!current.done) {
    if (verboseLogging && lineNumber % 100_000 === 0) {
      console.log(`Processed ${withCommas(lineNumber)} lines...`);
    }

    const parsedLine = trySync(() => {
      if (!isOptimized) {
        return stringifiedBarSchema.parse(current.value!.split(','));
      } else {
        return stringifiedOptimizedBarSchema.parse(current.value!.split(','));
      }
    });
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
