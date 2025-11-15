import { getAggregateDataIterator, type Bar } from '@/algorithms/read-data';
import { tryAsync, trySync } from '@/utils/errorHandling';
import { withCommas } from '@/utils/number-utils';
import fs from 'fs';

type StockSplitRatio = [after: number, before: number];

type Fix = { line: number; normalizeConstant: number };

const stockSplits: StockSplitRatio[] = [
  // forward spltis
  [2, 1], // 2 shareMult
  [3, 1], // 3 shareMult
  [4, 1], // 4 shareMult
  [5, 1], // 5 shareMult

  // reverse splits
  [1, 2], // 1/2 shareMult
  [1, 5], // 1/5 shareMult
  [1, 10], // 1/10 shareMult
];

const SPLIT_ERROR_THRESHOLD = 0.03;

export async function correctStockSplits(tickDataFilename: string, replaceFile = true) {
  if (!tickDataFilename.endsWith('.csv')) {
    throw new Error(`'${tickDataFilename}' is not a CSV file`);
  }

  const iterator = getAggregateDataIterator(tickDataFilename, true);

  const prevPriceResponse = await iterator.next();
  if (prevPriceResponse.done) {
    console.error(`No data found in ${tickDataFilename}`);
    return;
  }
  let prevPrice = prevPriceResponse.value[4];

  let lineNumber = 3;
  const fixes: Fix[] = [];
  for await (const bar of iterator) {
    if (isStockSplit(prevPrice, bar[4])) {
      console.log(
        `Found unaccounted for stock split on line ${withCommas(lineNumber)} of '${tickDataFilename}' from ${prevPrice} to ${bar[4]}`,
      );
      const stockSplitRatio = getStockSplitRatio(prevPrice, bar[4]);
      console.log(
        `Stock split ratio: ${stockSplitRatio[0]}:${stockSplitRatio[1]} on line ${withCommas(lineNumber)} of '${tickDataFilename}'`,
      );

      // if split is 2:1, e.g., then there is a 50% price drop that is unaccoutned for
      // multiply all previous data by 0.5 to account for this.
      const multiplyConstant = stockSplitRatio[1] / stockSplitRatio[0];

      for (const fix of fixes) {
        fix.normalizeConstant *= multiplyConstant;
      }
      fixes.push({
        line: lineNumber,
        normalizeConstant: multiplyConstant,
      });
    }
    prevPrice = bar[4];
    lineNumber++;
  }

  if (fixes.length > 0) {
    console.log(
      `${fixes.length} stock splits detected in '${tickDataFilename}'; correcting data...`,
    );

    const baseTickDataFilename = tickDataFilename.slice(0, -4);
    let correctedBaseTickDataFilename = baseTickDataFilename + '_corrected';

    // generate a unique filename
    if (fs.existsSync(`${correctedBaseTickDataFilename}.csv`)) {
      correctedBaseTickDataFilename += `_${Math.floor(Math.random() * 10)}`;
    }
    while (fs.existsSync(`${correctedBaseTickDataFilename}.csv`)) {
      correctedBaseTickDataFilename += Math.floor(Math.random() * 10).toString();
    }
    const correctedTickDataFilename = `${correctedBaseTickDataFilename}.csv`;
    console.log(`Writing corrected data to '${correctedTickDataFilename}'`);

    const correctStockDataResponse = await tryAsync(() =>
      correctStockData(tickDataFilename, correctedTickDataFilename, fixes),
    );
    if (!correctStockDataResponse.ok) throw correctStockDataResponse.error;

    if (replaceFile) {
      console.log(`Replacing original file '${tickDataFilename}' with corrected data`);
      const deleteOriginalFileResponse = trySync(() => fs.unlinkSync(tickDataFilename));
      if (!deleteOriginalFileResponse.ok) throw deleteOriginalFileResponse.error;

      const renameFileResponse = trySync(() =>
        fs.renameSync(correctedTickDataFilename, tickDataFilename),
      );
      if (!renameFileResponse.ok) throw renameFileResponse.error;
      console.log(`Successfully replaced original file '${tickDataFilename}' with corrected data`);
    }
  } else {
    console.log(`No fixes found in '${tickDataFilename}'; file is already corrected`);
  }
}

async function correctStockData(tickDataFilename: string, writeToFilename: string, fixes: Fix[]) {
  const iterator = getAggregateDataIterator(tickDataFilename, true);

  // Write header
  const writeHeaderResponse = trySync(() =>
    fs.writeFileSync(writeToFilename, 'timestamp,open,high,low,close,volume\n'),
  );
  if (!writeHeaderResponse.ok) throw writeHeaderResponse.error;

  let fixIndex = 0;
  let lineNumber = 2;
  for await (const bar of iterator) {
    if (fixIndex < fixes.length && lineNumber === fixes[fixIndex].line) {
      fixIndex++;
    }

    if (fixIndex < fixes.length) {
      const { line, normalizeConstant } = fixes[fixIndex];
      if (lineNumber < line) {
        const [t, o, h, l, c, v] = bar;
        const normalizedBar: Bar = [
          t,
          o * normalizeConstant,
          h * normalizeConstant,
          l * normalizeConstant,
          c * normalizeConstant,
          v,
        ];

        const writeFileResponse = trySync(() =>
          fs.appendFileSync(writeToFilename, normalizedBar.join(',') + '\n', { flag: 'a' }),
        );
        if (!writeFileResponse.ok) throw writeFileResponse.error;
      }
    } else {
      const writeFileResponse = trySync(() =>
        fs.appendFileSync(writeToFilename, bar.join(',') + '\n', { flag: 'a' }),
      );
      if (!writeFileResponse.ok) throw writeFileResponse.error;
    }
    lineNumber++;
  }
  console.log(`Successfully written to ${writeToFilename}`);
}

function isStockSplit(prevPrice: number, currentPrice: number): boolean {
  const percentChange = (currentPrice - prevPrice) / prevPrice;
  return percentChange < -0.4 || 0.9 < percentChange;
}

function getStockSplitRatio(prevPrice: number, currentPrice: number): StockSplitRatio {
  const predictedShareMult = prevPrice / currentPrice;
  let bestStockSplitMatch: StockSplitRatio = stockSplits[0];
  let shareMultError = Math.abs(predictedShareMult - stockSplits[0][0] / stockSplits[0][1]);

  for (let i = 1; i < stockSplits.length; i++) {
    const stockSplitShareMult = stockSplits[i][0] / stockSplits[i][1];
    const error = Math.abs(predictedShareMult - stockSplitShareMult);
    if (error < shareMultError) {
      shareMultError = error;
      bestStockSplitMatch = stockSplits[i];
    }
  }

  if (shareMultError > SPLIT_ERROR_THRESHOLD) {
    console.error(
      `Stock split ratio ${bestStockSplitMatch[0]}:${bestStockSplitMatch[1]} is not close enough to the predicted share multiplier ${predictedShareMult}; proceeding regardless`,
    );
  }
  return bestStockSplitMatch;
}
