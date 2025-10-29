import type { Bar, OptimizedBar } from '@/algorithms/read-data';
import { config } from '@/lib/config';
import { etDateStringToTimestamp, isMarketOpen } from '@/utils/date-utils';
import { tryAsync, trySync } from '@/utils/errorHandling';
import { retryWithBackoffAsync } from '@/utils/retry';
import zodSafeFetch from '@/utils/zod-safe-fetch';
import fs from 'fs';
import z from 'zod';

const apiResponseSchema = z.union([
  z.object({
    'Meta Data': z.object(),
    'Time Series (60min)': z.record(
      z.string(),
      z.object({
        '1. open': z.coerce.number(),
        '2. high': z.coerce.number(),
        '3. low': z.coerce.number(),
        '4. close': z.coerce.number(),
        '5. volume': z.coerce.number(),
      }),
    ),
  }),
  z.object({ 'Error Message': z.string() }),
]);

export type Ticker = 'SPY' | 'SPUU' | 'SPXL' | 'SPX' | 'SH' | 'SDS' | 'SPXU' | (string & {});
export type Timestamp = '1min' | '5min' | '15min' | '30min' | '60min';

const aggregateInMillisecondsByTimestamp: Record<Timestamp, number> = {
  '1min': 60_000,
  '5min': 300_000,
  '15min': 900_000,
  '30min': 1_800_000,
  '60min': 3_600_000,
};

export async function fetchAlphaVantageData({
  ticker,
  years,
  timestamp,
  writeToFile,
  isOptimized = true,
}: {
  ticker: Ticker;
  years: number;
  timestamp: Timestamp;
  writeToFile?: string;
  isOptimized?: boolean;
}) {
  const apiKey = config.getKey('ALPHA_VANTAGE_API_KEY');

  // Write header if file doesn't exist
  if (writeToFile != undefined) {
    const writeHeaderResponse = trySync(() => {
      if (!isOptimized) {
        fs.writeFileSync(writeToFile, 'timestamp,open,high,low,close,volume\n');
      } else {
        fs.writeFileSync(writeToFile, 'timestamp,open,high,low,close,volume,market open\n');
      }
    });
    if (!writeHeaderResponse.ok) throw writeHeaderResponse.error;
  }

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const aggregateInMilliseconds = aggregateInMillisecondsByTimestamp[timestamp];
  for (let y = currentYear - years; y <= currentYear; y++) {
    const endMonth = y === currentYear ? currentMonth - 1 : 12;
    for (let m = 1; m <= endMonth; m++) {
      // in YYYY-MM format
      const month = `${y}-${m.toString().padStart(2, '0')}`;
      const url =
        'https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&' +
        [
          `symbol=${ticker}`,
          `interval=${timestamp}`,
          'adjusted=true',
          `month=${month}`,
          'outputsize=full',
          `apikey=${apiKey}`,
        ].join('&');

      console.log(`Fetching ${ticker} (${timestamp}) data for ${month}...`);
      const fetchWithRetryResponse = await tryAsync(() =>
        retryWithBackoffAsync(() => zodSafeFetch({ url, schema: apiResponseSchema }), 6),
      );
      if (!fetchWithRetryResponse.ok) throw fetchWithRetryResponse.error;
      const apiResponse = fetchWithRetryResponse.data;

      if ('Error Message' in apiResponse) {
        // Data does not exist for this ticker, so skip this month
        console.log(`No data found for ${ticker} (${timestamp}) in ${month}`);
        continue;
      }
      const tickData = apiResponse['Time Series (60min)'];

      const dates: [string, number][] = Object.keys(tickData)
        .reverse()
        .map((dateAsString: string) => {
          const timestamp = etDateStringToTimestamp(dateAsString);
          return [dateAsString, timestamp];
        });

      for (let i = 1; i < dates.length; i++) {
        if (dates[i - 1][1] >= dates[i][1]) {
          console.log('Sorting dates...');
          dates.sort((a, b) => a[1] - b[1]);
        }
      }

      const chunks = dates.map(([dateAsString]) => {
        const barAsObj = tickData[dateAsString];
        if (!isOptimized) {
          const data: Bar = [
            dateAsString,
            barAsObj['1. open'],
            barAsObj['2. high'],
            barAsObj['3. low'],
            barAsObj['4. close'],
            barAsObj['5. volume'],
          ];
          return data.join(',');
        } else {
          const tickStartTimestamp = etDateStringToTimestamp(dateAsString);
          const tickEndDate = new Date(tickStartTimestamp + aggregateInMilliseconds);
          const marketOpen = isMarketOpen(tickEndDate);

          const data: OptimizedBar = [
            dateAsString,
            barAsObj['1. open'],
            barAsObj['2. high'],
            barAsObj['3. low'],
            barAsObj['4. close'],
            barAsObj['5. volume'],
            marketOpen,
          ];
          return data.join(',');
        }
      });

      if (writeToFile != undefined) {
        const content = chunks.join('\n') + '\n';
        const fileWriteResponse = trySync(() => fs.appendFileSync(writeToFile, content));
        if (!fileWriteResponse.ok) throw fileWriteResponse.error;
      }
    }
  }
}
