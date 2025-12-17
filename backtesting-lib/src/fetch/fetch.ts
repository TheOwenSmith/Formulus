import type { Bar } from '@/backtesting/read-data';
import { config } from '@/lib/config';
import { tryAsync, trySync } from '@/utils/errorHandling';
import { retryWithBackoff } from '@/utils/retry';
import { zodSafeFetch } from '@/utils/zod-safe-fetch';
import { spawnSync } from 'child_process';
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
    z.object({ Information: z.string() }),
  ]);

export type Ticker = 'SPY' | 'SPUU' | 'SPXL' | 'SPX' | 'SH' | 'SDS' | 'SPXU' | (string & {});

export const aggregateTimestamps = ['1min', '5min', '15min', '30min', '60min'] as const;
export type Timestamp = (typeof aggregateTimestamps)[number];

export const tickDataCsvHeader = 'timestamp,open,high,low,close,volume\n';

export async function fetchAlphaVantageData({
  ticker,
  years,
  timestamp,
  verboseLogging = false,
}: {
  ticker: Ticker;
  years: number;
  timestamp: Timestamp;
  verboseLogging?: boolean;
}) {
  console.log(`Fetching data for '${ticker}' (${timestamp})...`);
  const apiKey = config.getKey('ALPHA_VANTAGE_API_KEY');
  const apiResponseSchema = apiResponseSchemaFromTimestamp(timestamp);

  const writeToFilename = `${ticker}_${timestamp}.csv`;
  const writeToFile = `./data/uncleaned/${writeToFilename}`;
  if (!fs.existsSync('./data/uncleaned')) {
    const makeDirResponse = trySync(() => fs.mkdirSync('./data/uncleaned', { recursive: true }));
    if (!makeDirResponse.ok) throw makeDirResponse.error;
  }

  // Write header
  const writeHeaderResponse = trySync(() => fs.writeFileSync(writeToFile, tickDataCsvHeader));
  if (!writeHeaderResponse.ok) throw writeHeaderResponse.error;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  for (let y = currentYear - years; y <= currentYear; y++) {
    const endMonth = y === currentYear ? currentMonth - 1 : 12;
    for (let m = 1; m <= endMonth; m++) {
      // In YYYY-MM format
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

      if (verboseLogging) {
        console.log(`Fetching '${ticker}' (${timestamp}) data for ${month}...`);
      }
      const fetchWithRetryResponse = await tryAsync(() =>
        retryWithBackoff({
          fn: async () => {
            const response = await zodSafeFetch({ url, schema: apiResponseSchema });
            if ('Information' in response) {
              throw new Error('Rate limit reached');
            }
            return response;
          },
          maxRetries: 6,
          verboseLogging,
        }),
      );
      if (!fetchWithRetryResponse.ok) throw fetchWithRetryResponse.error;
      const apiResponse = fetchWithRetryResponse.data;

      if ('Error Message' in apiResponse) {
        // Data does not exist for this ticker, so skip this month
        if (verboseLogging) {
          console.log(`No data found for '${ticker}' (${timestamp}) in ${month}`);
        }
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

  console.log(`Cleaning data for '${ticker}' (${timestamp})...`);
  cleanData(writeToFilename, timestamp);
}

export function cleanData(writeToFilename: string, timestamp: Timestamp) {
  const pythonScriptResponse = trySync(() =>
    spawnSync('python', ['../clean-data/clean-data.py', writeToFilename, timestamp], {
      stdio: 'inherit',
    }),
  );
  if (!pythonScriptResponse.ok) {
    console.error('Error running python script to clean data');
    throw pythonScriptResponse.error;
  }
}
