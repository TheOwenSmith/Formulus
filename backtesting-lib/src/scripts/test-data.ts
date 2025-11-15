import { getAggregateDataIterator, type AggregateDataIterator } from '@/backtesting/read-data';

async function getLatestStartTimestamp(iters: AggregateDataIterator[]): Promise<string | null> {
  const startTimestamps: string[] = [];
  for (const iter of iters) {
    const iterResult = await iter.next();
    if (iterResult.done) {
      return null;
    }

    const timestamp = iterResult.value[0];
    startTimestamps.push(timestamp);
    // iter.close();
  }

  let latestStartTimestamp = startTimestamps[0];
  for (let i = 1; i < startTimestamps.length; i++) {
    if (startTimestamps[i] > latestStartTimestamp) {
      latestStartTimestamp = startTimestamps[i];
    }
  }
  return latestStartTimestamp;
}

export async function testData(files: string[]) {
  console.log('finding latest start timestamp...');
  const iters: AggregateDataIterator[] = files.map((file) => getAggregateDataIterator(file));
  const latestStartTimestamp: string | null = await getLatestStartTimestamp(iters);
  if (latestStartTimestamp == null) {
    throw new Error();
  }

  console.log({ latestStartTimestamp });

  // Skip all data before the latest start timestamp
  const currentTimestampForIterator: string[] = Array(iters.length).fill('');
  for (let i = 0; i < iters.length; i++) {
    while (true) {
      const iterResult = await iters[i].next();
      if (iterResult.done) {
        return;
      }

      const timestamp: string = iterResult.value[0];
      // We can compare timestamp strings of the form (YYYY-MM-DD HH:MM:SS) lexicographically to see which comes first
      if (timestamp >= latestStartTimestamp) {
        currentTimestampForIterator[i] = timestamp;
        break;
      }
    }
  }

  console.log('Checking for missing data...');
  while (true) {
    // check if all the timestamps are equal
    let allTimestampsEqual = true;
    for (let i = 1; i < iters.length; i++) {
      if (currentTimestampForIterator[i] !== currentTimestampForIterator[0]) {
        allTimestampsEqual = false;
        break;
      }
    }

    // if not, find the next matching timestamp
    if (!allTimestampsEqual) {
      let latestCurrentTimestamp: string = currentTimestampForIterator[0];

      let needsCorrection = true;
      const skippedTimestamps = new Set<string>();
      while (needsCorrection) {
        needsCorrection = false; // assume this correction will be sufficient unless proven otherwise

        for (let i = 1; i < iters.length; i++) {
          while (currentTimestampForIterator[i] < latestCurrentTimestamp) {
            skippedTimestamps.add(currentTimestampForIterator[i]);

            const iterResult = await iters[i].next();
            if (iterResult.done) {
              return;
            }

            const timestamp = iterResult.value[0];
            currentTimestampForIterator[i] = timestamp;
          }

          if (currentTimestampForIterator[i] > latestCurrentTimestamp) {
            needsCorrection = true;
            latestCurrentTimestamp = currentTimestampForIterator[i];
          }
        }
      }

      // sort timestamps lexicographically (chronologically)
      const skippedTimestampsSorted = Array.from(skippedTimestamps).sort();
      for (const skippedTimestamp of skippedTimestampsSorted) {
        console.log(`missing data for: ${skippedTimestamp}`);
      }

      // since days are now equal, we incremenent each
      for (let i = 0; i < iters.length; i++) {
        const iterResult = await iters[i].next();
        if (iterResult.done) {
          return;
        }

        const timestamp: string = iterResult.value[0];
        currentTimestampForIterator[i] = timestamp;
      }
    }
  }
}
