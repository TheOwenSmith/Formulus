import z from 'zod';

// Ticker
export const tickers = ['SPY', 'SPUU', 'SPXL', 'SPX', 'SH', 'SDS', 'SPXU'] as const;
export type Ticker = (typeof tickers)[number] | (string & {});
export const tickerSchema = z.enum(tickers);

// Timestamp
export const aggregateTimestamps = ['1min', '5min', '15min', '30min', '60min'] as const;
export type Timestamp = (typeof aggregateTimestamps)[number];
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
