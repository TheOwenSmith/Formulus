import type { Bar } from '@/backtesting/read-data';
import { config } from '@/lib/config';
import { tryAsync, trySync } from '@/utils/errorHandling';
import { retryWithBackoffAsync } from '@/utils/retry';
import { zodSafeFetch } from '@/utils/zod-safe-fetch';
import fs from 'fs';
import z from 'zod';

const apiResponseSchemaFromTimestamp = (timestamp: Timestamp) =>
  z.union([
    z.object({
      'Meta Data': z.object(),
      [`Time Series (${timestamp})`]: z.record(
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

export const aggregateInMillisecondsFromTimestamp: Record<Timestamp, number> = {
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
}: {
  ticker: Ticker;
  years: number;
  timestamp: Timestamp;
}) {
  const apiKey = config.getKey('ALPHA_VANTAGE_API_KEY');
  const apiResponseSchema = apiResponseSchemaFromTimestamp(timestamp);

  const writeToFile = `./data/cleaned/${ticker}_${timestamp}.csv`;
  if (!fs.existsSync(writeToFile)) {
    const makeDirResponse = trySync(() => fs.mkdirSync('./data/cleaned', { recursive: true }));
    if (!makeDirResponse.ok) throw makeDirResponse.error;
  }

  // Write header
  const writeHeaderResponse = trySync(() =>
    fs.writeFileSync(writeToFile, 'timestamp,open,high,low,close,volume\n'),
  );
  if (!writeHeaderResponse.ok) throw writeHeaderResponse.error;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
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
      const tickData = apiResponse[`Time Series (${timestamp})`];

      const dates: string[] = Object.keys(tickData).reverse();
      const chunks = dates.map((dateAsString) => {
        const barAsObj = tickData[dateAsString];
        const data: Bar = [
          dateAsString,
          barAsObj['1. open'],
          barAsObj['2. high'],
          barAsObj['3. low'],
          barAsObj['4. close'],
          barAsObj['5. volume'],
        ];
        return data.join(',');
      });

      const content = chunks.join('\n') + '\n';
      const fileWriteResponse = trySync(() => fs.appendFileSync(writeToFile, content));
      if (!fileWriteResponse.ok) throw fileWriteResponse.error;
    }
  }
}
