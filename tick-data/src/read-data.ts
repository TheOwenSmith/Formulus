import fs from 'fs';
import readline from 'readline';
import z from 'zod';
import { trySync } from './utils/errorHandling';

const lineOfFileSchema = z.tuple([
  z.string(),
  z.coerce.number(),
  z.coerce.number(),
  z.coerce.number(),
  z.coerce.number(),
  z.coerce.number(),
]);

export type Tick = [t: string, o: number, h: number, l: number, c: number, v: number];

export async function getAllAggregateData(filename: string): Promise<Tick[]> {
  const iter = readline
    .createInterface({
      input: fs.createReadStream(filename),
      crlfDelay: Infinity,
    })
    [Symbol.asyncIterator]();

  await iter.next(); // headers
  let current = await iter.next();

  const data: Tick[] = [];
  let lineNumber = 1;
  while (!current.done) {
    const parsedLine = trySync(() => lineOfFileSchema.parse(current.value!.split(',')));
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

export async function* getAggregateDataIterator(filename: string): AsyncGenerator<Tick> {
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
    const parsedLine = trySync(() => lineOfFileSchema.parse(current.value!.split(',')));
    if (!parsedLine.ok) {
      console.error(`Error parsing line ${lineNumber}: ${current.value}`, parsedLine.error);
      throw parsedLine.error;
    }
    yield parsedLine.data;
    lineNumber++;
    current = await iter.next();
  }
}
