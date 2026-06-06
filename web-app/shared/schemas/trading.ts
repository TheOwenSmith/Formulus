import z from 'zod';
import { aggregateTimestamps, tickers } from '@shared/constants/trading';

export const tickerSchema = z.enum(tickers);
export type UserTicker = z.infer<typeof tickerSchema>;

export const stringifiedBarSchema = z.tuple([
  z.string(),
  z.coerce.number(),
  z.coerce.number(),
  z.coerce.number(),
  z.coerce.number(),
  z.coerce.number(),
]);

export const timestampSchema = z.enum(aggregateTimestamps);
