import { type Bar } from '@shared/constants/trading';
import { stringifiedBarSchema } from '@shared/schemas/trading';
import {
  fromThrowable,
  fromThrowableAsync,
  internal,
  type AppError,
} from '@shared/utils/error-handling';
import { cleanup } from '@worker/utils/cleanup';
import { withCommas } from '@worker/utils/number-utils';
import fs from 'fs';
import { err, ok, type Result } from 'neverthrow';
import readline from 'readline';

const LINES_PROGRESS_UPDATE_INTERVAL = 1_000_000;

export type AggregateDataIterator = AsyncGenerator<
  { bar: Bar; bytesProcessed: number },
  Result<null, AppError>
> & {
  close: () => Promise<Result<undefined, AppError>>;
};

export function getAggregateDataIterator({
  endByte,
  filename,
  parseStrictly,
  startByte,
  verboseLogging = false,
}: {
  endByte?: number;
  filename: string;
  parseStrictly: boolean;
  startByte?: number;
  verboseLogging?: boolean;
}): Result<AggregateDataIterator, AppError> {
  if (!fs.existsSync(filename)) {
    return err(internal(undefined, `File '${filename}' does not exist`));
  }

  const createFileStreamResponse = fromThrowable(
    () =>
      fs.createReadStream(filename, {
        ...(startByte != undefined ? { start: startByte } : {}),
        ...(endByte != undefined ? { end: endByte } : {}),
      }),
    (e) => internal(e),
  );
  if (createFileStreamResponse.isErr()) return err(createFileStreamResponse.error);
  const fileStream = createFileStreamResponse.value;

  const rlInterface = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  const iter = rlInterface[Symbol.asyncIterator]();

  async function close(): Promise<Result<undefined, AppError>> {
    const cleanupResult = await cleanup([() => rlInterface.close(), () => fileStream.destroy()]);
    if (cleanupResult.isErr()) return err(internal(cleanupResult.error));
    return ok(undefined);
  }

  async function* generator(): AsyncGenerator<
    { bar: Bar; bytesProcessed: number },
    Result<null, AppError>
  > {
    const getCurrentLineResponse = await fromThrowableAsync(iter.next, (e) => internal(e));
    if (getCurrentLineResponse.isErr()) return err(getCurrentLineResponse.error);
    let current = getCurrentLineResponse.value;

    let linesProcessed = 0;
    while (!current.done) {
      if (verboseLogging && ++linesProcessed % LINES_PROGRESS_UPDATE_INTERVAL === 0) {
        console.log(`Processed ${withCommas(linesProcessed)} lines...`);
      }

      const stringifiedLine = current.value!;
      // Account for \r\n, but not for the first line
      const bytesProcessed = Buffer.byteLength(stringifiedLine) + (linesProcessed > 1 ? 2 : 0);

      if (parseStrictly) {
        const parsedLine = fromThrowable(
          () => stringifiedBarSchema.parse(stringifiedLine.split(',')),
          (e) => internal(e, `Error parsing file '${filename}' line '${stringifiedLine}'`),
        );
        if (parsedLine.isErr()) {
          await close();
          return err(parsedLine.error);
        }
        const bar = parsedLine.value;
        yield { bar, bytesProcessed };
      } else {
        const split = stringifiedLine.split(',');
        const bar = [split[0], ...split.slice(1, 6).map(Number)] as Bar;
        yield { bar, bytesProcessed };
      }

      const getNextLineResponse = await fromThrowableAsync(iter.next, (e) => internal(e));
      if (getNextLineResponse.isErr()) return err(getNextLineResponse.error);
      current = getNextLineResponse.value;
    }
    return ok(null);
  }

  const gen = generator();
  return ok(Object.assign(gen, { close }));
}
