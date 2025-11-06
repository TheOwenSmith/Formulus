import { correctStockSplits } from '@/fetch/correct-stock-splits';
import fs from 'fs';
import path from 'path';

// const tickers: Ticker[] = [
//   'SPY',
//   'SPUU',
//   'SPXL',
//   'SH',
//   'SDS',
//   'SPXU',
//   'QQQ',
//   'NVDA',
//   'TSLA',
//   'AMD',
//   'META',
//   'AAPL',
//   'MSFT',
//   'AMZN',
//   'GOOG',
//   'PLTR',
//   'SNAP',
//   'PFE',
// ];
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
  await correctStockSplits(filepath, false);
}

// await testData([
//   './data/SPY_60min.csv',
//   './data/SPUU_60min.csv',
//   './data/SPXL_60min.csv',
//   './data/SH_60min.csv',
//   './data/SDS_60min.csv',
//   './data/SPXU_60min.csv',
// ]);
