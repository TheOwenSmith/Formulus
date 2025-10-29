import { getAggregateDataIterator, type OptimizedBar } from '@/algorithms/read-data';
import { etDateStringToTimestamp, isMarketOpen } from '@/utils/date-utils';
import { trySync } from '@/utils/errorHandling';
import { withCommas } from '@/utils/number-utils';
import fs from 'fs';

export async function optimizeTickDataFile(
  tickDataFilename: string,
  optimizedTickDataFilename: string,
  aggregateInMilliseconds: number,
) {
  const iterator = getAggregateDataIterator(tickDataFilename, false);

  const writeHeaderesResponse = trySync(() =>
    fs.writeFileSync(
      optimizedTickDataFilename,
      'timestamp,open,high,low,close,volume,market open\n',
    ),
  );
  if (!writeHeaderesResponse.ok) throw writeHeaderesResponse.error;

  let linesWritten = 0;
  for await (const bar of iterator) {
    const [dateAsString, o, h, l, c, v] = bar;
    const tickStartTimestamp = etDateStringToTimestamp(dateAsString);
    const tickEndDate = new Date(tickStartTimestamp + aggregateInMilliseconds);
    const marketOpen = isMarketOpen(tickEndDate);

    const optimizedBar: OptimizedBar = [dateAsString, o, h, l, c, v, marketOpen];
    const writeFileResponse = trySync(() =>
      fs.appendFileSync(optimizedTickDataFilename, optimizedBar.join(',') + '\n'),
    );
    if (!writeFileResponse.ok) throw writeFileResponse.error;

    if (++linesWritten % 10_000) console.log(`Wrote ${withCommas(linesWritten)} lines...`);
  }
}
