import { correctStockSplits } from '@/fetch/correct-stock-splits';
import fs from 'fs';
import path from 'path';

// const tickers: Ticker[] = ['SPY', 'SPUU', 'SPXL', 'SH', 'SDS', 'SPXU'];
// for (const ticker of tickers) {
//   await fetchAlphaVantageData({
//     ticker,
//     years: 20,
//     timestamp: '60min',
//     writeToFile: `./data/${ticker}_60min.csv`,
//   });
// }

const filenames = fs.readdirSync('./data');
for (const filename of filenames) {
  const filepath = path.resolve('./data', filename);
  await correctStockSplits(filepath);
}
