import { config } from '@api/lib/config';
import { fromThrowable, internal, type AppError } from '@api/utils/error-handling';
import { retryWithBackoff } from '@api/utils/retry';
import { zodSafeFetch } from '@api/utils/zod-safe-fetch';
import fs from 'fs';
import { err, ok, Result } from 'neverthrow';
import z from 'zod';
import type { Bar } from './types';
import { tickDataCsvHeader, type Ticker, type Timestamp } from './types';

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
}): Promise<Result<undefined, AppError>> {
  console.log(`Fetching data for '${ticker}' (${timestamp})...`);
  const apiKey = config.getKey('ALPHA_VANTAGE_API_KEY');
  const apiResponseSchema = apiResponseSchemaFromTimestamp(timestamp);

  const writeToFile = `../worker/data/uncleaned/${ticker}_${timestamp}.csv`;
  if (!fs.existsSync('../worker/data/uncleaned')) {
    const makeDirResponse = fromThrowable(
      () => fs.mkdirSync('../worker/data/uncleaned', { recursive: true }),
      (e) => internal(e),
    );
    if (makeDirResponse.isErr()) {
      return err(makeDirResponse.error);
    }
  }

  // Write header
  const writeHeaderResponse = fromThrowable(
    () => fs.writeFileSync(writeToFile, tickDataCsvHeader),
    (e) => internal(e),
  );
  if (writeHeaderResponse.isErr()) {
    return err(writeHeaderResponse.error);
  }
  if (writeHeaderResponse.isErr()) {
    return err(writeHeaderResponse.error);
  }

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
      const fetchWithRetryResponse = await retryWithBackoff({
        fn: async () => {
          const response = await zodSafeFetch({ url, schema: apiResponseSchema });
          if ('Information' in response) {
            throw new Error('Rate limit reached');
          }
          return response;
        },
        maxRetries: 6,
        verboseLogging,
      });
      if (fetchWithRetryResponse.isErr()) {
        return err(fetchWithRetryResponse.error);
      }
      const apiResponse = fetchWithRetryResponse.value;

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
      const fileWriteResponse = fromThrowable(
        () => fs.appendFileSync(writeToFile, content),
        (e) => internal(e),
      );
      if (fileWriteResponse.isErr()) {
        return err(fileWriteResponse.error);
      }
    }
  }
  return ok(undefined);
}
