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

type Tick = [o: number, h: number, l: number, c: number, v: number];

export async function getAllAggregateData(filename: string): Promise<Tick[]> {
  const lines = readline.createInterface({
    input: fs.createReadStream(filename),
    crlfDelay: Infinity,
  });

  const data: Tick[] = [];
  for await (const line of lines) {
    const parsedLine = trySync(() => lineOfFileSchema.parse(line.split(',')));
    if (!parsedLine.ok) throw parsedLine.error;
    const [_t, o, h, l, c, v] = parsedLine.data;
    data.push([o, h, l, c, v]);
  }
  return data;
}

export async function* getAggregateDataIterator(filename: string): AsyncIterator<Tick> {
  const lines = readline.createInterface({
    input: fs.createReadStream(filename),
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    const parsedLine = trySync(() => lineOfFileSchema.parse(line.split(',')));
    if (!parsedLine.ok) throw parsedLine.error;
    const [_t, o, h, l, c, v] = parsedLine.data;
    yield [o, h, l, c, v];
  }
}
