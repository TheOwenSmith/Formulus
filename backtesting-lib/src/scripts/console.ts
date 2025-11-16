import { fetchAlphaVantageData, type Ticker } from '@/fetch/fetch';

const tickers: Ticker[] = [
  'SPY',
  'SSO',
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

// await testData([
//   './data/cleaned/SPY_60min.csv',
//   './data/cleaned/SSO_60min.csv',
//   './data/cleaned/SPXL_60min.csv',
//   './data/cleaned/SH_60min.csv',
//   './data/cleaned/SDS_60min.csv',
//   './data/cleaned/SPXU_60min.csv',
// ]);
