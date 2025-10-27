import { client } from '@/lib/polygon';
import { GetStocksAggregatesTimespanEnum } from '@polygon.io/client-js';
import fs from 'fs';
import path from 'path';
import z from 'zod';
import { formatDate } from '../utils/date-utils';
import { tryAsync, trySync } from '../utils/errorHandling';
import { retryWithBackoffAsync, retryWithBackoffSync } from '../utils/retry';
import type { Nullish } from '../utils/types';
import { getChunksFromTimestamp } from './chunks';

type Ticker = 'SPY';

const aggregateApiResponseSchema = z
  .object({
    t: z.number(),
    o: z.number(),
    h: z.number(),
    l: z.number(),
    c: z.number(),
    v: z.number(),
  })
  .array()
  .nullish();

export async function fetchAggregateData({
  ticker,
  years,
  timestamp,
  multiplier = 1,
  directory = './data',
}: {
  ticker: Ticker;
  years: number;
  timestamp: GetStocksAggregatesTimespanEnum;
  multiplier?: number;
  directory?: string;
}) {
  console.log(`Fetching ${years} years of ${multiplier}${timestamp} data for ${ticker}...`);
  const chunks = getChunksFromTimestamp(timestamp, years);
  const fromDate = chunks[0].from;
  const toDate = chunks[chunks.length - 1].to;

  const filename = `${ticker}_${multiplier}${timestamp.toUpperCase()}_${formatDate(new Date(fromDate))}_to_${formatDate(new Date(toDate))}.csv`;
  const filepath = path.join(directory, filename);

  // Remove existing file if it exists
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }

  // Write CSV header
  fs.writeFileSync(filepath, 'Timestamp,Open,High,Low,Close,Volume\n');

  let totalBars = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const progress = (((i + 1) / chunks.length) * 100).toFixed(1);

    console.log(
      `[${i + 1}/${chunks.length}] (${progress}%) Fetching ${new Date(chunk.from).toISOString()} to ${new Date(chunk.to).toISOString()}...`,
    );

    const getAggregateChunkResponse = await tryAsync(() =>
      retryWithBackoffAsync(
        () =>
          fetchAggregateChunkFromApi({
            ticker,
            multiplier,
            timestamp,
            from: chunk.from instanceof Date ? formatDate(chunk.from) : chunk.from.toString(),
            to: chunk.to instanceof Date ? formatDate(chunk.to) : chunk.to.toString(),
          }),
        3, // maxRetries
        1000, // initialDelayMs
        30000, // maxDelayMs
      ),
    );
    if (!getAggregateChunkResponse.ok) {
      console.error(`  ⚠ API request failed for this period`);
      console.error(getAggregateChunkResponse.error);
      continue;
    }
    const bars = getAggregateChunkResponse.data;

    // Append data to CSV
    if (bars != undefined && bars.length > 0) {
      for (const bar of bars) {
        const timestamp = new Date(bar.t).toISOString();
        const row = `${timestamp},${bar.o},${bar.h},${bar.l},${bar.c},${bar.v}\n`;
        const writeFileResponse = await tryAsync(() =>
          retryWithBackoffSync(() => fs.appendFileSync(filepath, row)),
        );
        if (!writeFileResponse.ok) {
          console.error(`  ⚠ Failed to write to file for this period`);
          continue;
        }
      }

      totalBars += bars.length;
      console.log(`  ✓ Retrieved ${bars.length} bars (Total: ${totalBars})`);
    } else {
      console.log(
        `  ⚠ No data available for this period (${new Date(chunk.from).toISOString()} to ${new Date(chunk.to).toISOString()})`,
      );
    }
  }

  console.log(
    `\n✓ Successfully retrieved ${totalBars} ${timestamp.toUpperCase()} bars for ${ticker}.`,
  );
  console.log(`\n✓ Data exported to ${filepath}`);
}

async function fetchAggregateChunkFromApi({
  ticker,
  multiplier,
  timestamp,
  from,
  to,
}: {
  ticker: Ticker;
  multiplier: number;
  timestamp: GetStocksAggregatesTimespanEnum;
  from: string;
  to: string;
}): Promise<Nullish<{ t: number; o: number; h: number; l: number; c: number; v: number }[]>> {
  const apiResponse = await tryAsync(() =>
    client.getStocksAggregates(ticker, multiplier, timestamp, from, to),
  );
  if (!apiResponse.ok) {
    console.error(apiResponse.error);
    throw apiResponse.error;
  }
  const aggregateData = apiResponse.data;

  const zodParseResponse = trySync(() => aggregateApiResponseSchema.parse(aggregateData.results));
  if (!zodParseResponse.ok) {
    console.error(zodParseResponse.error);
    throw zodParseResponse.error;
  }
  const parsedAggregateData = zodParseResponse.data;

  return parsedAggregateData;
}
