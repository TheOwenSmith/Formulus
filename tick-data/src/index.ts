import { GetStocksAggregatesTimespanEnum } from '@polygon.io/client-js';
import { fetchAggregateData } from './fetch-aggregate-data';

await fetchAggregateData({
  ticker: 'SPY',
  years: 5,
  timestamp: GetStocksAggregatesTimespanEnum.Second,
  multiplier: 1,
});
