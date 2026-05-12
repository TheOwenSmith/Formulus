import { GetObjectCommand } from '@aws-sdk/client-s3';
import { type Ticker } from '@shared/api';
import { aggregateTimestamps, type Timestamp } from '@shared/trading-constants';
import { s3 } from '@worker/lib/s3';
import { fromThrowableAsync, internal, type AppError } from '@worker/utils/error-handling';
import { ok, type Result } from 'neverthrow';
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

async function downloadToFile(
  bucket: string,
  key: string,
  localPath: string,
): Promise<Result<undefined, AppError>> {
  const getResult = await fromThrowableAsync(
    () => s3.send(new GetObjectCommand({ Bucket: bucket, Key: key })),
    (e) => internal(e, `S3 GetObject failed: s3://${bucket}/${key}`),
  );
  if (getResult.isErr()) return getResult;

  fs.mkdirSync(path.dirname(localPath), { recursive: true });

  const writeResult = await fromThrowableAsync(
    () => pipeline(getResult.value.Body as NodeJS.ReadableStream, fs.createWriteStream(localPath)),
    (e) => internal(e, `Failed to write ${localPath}`),
  );
  if (writeResult.isErr()) return writeResult;
  return ok(undefined);
}

export async function ensureDataFiles(
  distinctTickersByAggregate: Record<Timestamp, Ticker[]>,
  bucket: string,
): Promise<Result<undefined, AppError>> {
  for (const aggregate of aggregateTimestamps) {
    for (const ticker of distinctTickersByAggregate[aggregate]) {
      for (const key of [
        `cleaned/${ticker}_${aggregate}.csv`,
        `index/${ticker}_${aggregate}.idx`,
      ]) {
        const localPath = `./data/${key}`;
        if (fs.existsSync(localPath)) continue;
        console.log(`Downloading s3://${bucket}/${key} → ${localPath}`);
        const r = await downloadToFile(bucket, key, localPath);
        if (r.isErr()) return r;
      }
    }
  }
  return ok(undefined);
}
