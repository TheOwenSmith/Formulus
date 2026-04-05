import { aggregateTimestamps, tickers } from '@shared/trading-constants';
import z from 'zod';

export type Ticker = (typeof tickers)[number] | (string & {});
export const tickerSchema = z.enum(tickers);
export type UserTicker = z.infer<typeof tickerSchema>;
export const timestampSchema = z.enum(aggregateTimestamps);

// Bar
export type Bar = [t: string, o: number, h: number, l: number, c: number, v: number];
export const stringifiedBarSchema = z.tuple([
  z.string(),
  z.coerce.number(),
  z.coerce.number(),
  z.coerce.number(),
  z.coerce.number(),
  z.coerce.number(),
]);

// Header
export const tickDataCsvHeader = 'timestamp,open,high,low,close,volume\n';
