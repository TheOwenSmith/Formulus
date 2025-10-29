import { getDateChunks, getTimestampChunks } from '@/utils/date-utils';
import { GetStocksAggregatesTimespanEnum } from '@polygon.io/client-js';

type Chunk = { from: Date; to: Date } | { from: number; to: number };

export function getChunksFromTimestamp(
  timestamp: GetStocksAggregatesTimespanEnum,
  years: number,
): Chunk[] {
  if (timestamp === GetStocksAggregatesTimespanEnum.Second) {
    return getTimestampChunks(years, 86_400_000);
  }

  // Determine optimal chunk size based on timespan
  let chunkSizeInDays = 2;
  if (timestamp === GetStocksAggregatesTimespanEnum.Minute) {
    chunkSizeInDays = 7;
  } else if (timestamp === GetStocksAggregatesTimespanEnum.Hour) {
    chunkSizeInDays = 30;
  } else {
    chunkSizeInDays = 100;
  }
  console.log(`Processing data in chunks of ${chunkSizeInDays} days to optimize data retrieval.\n`);

  return getDateChunks(years, chunkSizeInDays);
}
