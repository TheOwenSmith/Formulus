import { createSearchIndex } from '@/fetch/create-search-index';
import { aggregateTimestamps, fetchAlphaVantageData, type Ticker } from '@/fetch/fetch';

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

for (const timestamp of aggregateTimestamps) {
  for (const ticker of tickers) {
    await fetchAlphaVantageData({
      ticker,
      years: 20,
      timestamp,
    });

    await createSearchIndex(ticker, timestamp);
  }
}
