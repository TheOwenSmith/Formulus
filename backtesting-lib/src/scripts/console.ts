import { fetchAlphaVantageData, type Ticker } from '@/fetch/fetch';
import { testData } from './test-data';

const tickers: Ticker[] = [
  'SPY',
  'SPUU',
  'SPXL',
  'SH',
  'SDS',
  'SPXU',
  'QQQ',
  'NVDA',
  'TSLA',
  'AMD',
  'META',
  'AAPL',
  'MSFT',
  'AMZN',
  'GOOG',
  'PLTR',
  'SNAP',
  'PFE',
];
for (const ticker of tickers) {
  await fetchAlphaVantageData({
    ticker,
    years: 20,
    timestamp: '60min',
  });
}

await testData([
  './data/uncleaned/SPY_60min.csv',
  './data/uncleaned/SPUU_60min.csv',
  './data/uncleaned/SPXL_60min.csv',
  './data/uncleaned/SH_60min.csv',
  './data/uncleaned/SDS_60min.csv',
  './data/uncleaned/SPXU_60min.csv',
]);
