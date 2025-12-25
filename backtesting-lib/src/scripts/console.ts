import { estimateSlippageBps } from '@/fetch/estimate-slippage';
import { aggregateTimestamps, type Ticker } from '@/fetch/types';
import { roundToDecimal } from '@/utils/number-utils';
import fs from 'fs';

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
  for (const timestamp of aggregateTimestamps) {
    // await fetchAlphaVantageData({
    //   ticker,
    //   years: 20,
    //   timestamp,
    // });
    // await cleanData(ticker, timestamp);
    // await createSearchIndex(ticker, timestamp);
  }

  const slippageBps = await estimateSlippageBps(ticker);
  if (slippageBps == null) {
    console.log(`Could not estimate slippage for ticker '${ticker}'`);
    continue;
  }
  const roundedSlippageBps = roundToDecimal(slippageBps, 2);
  fs.appendFileSync(`./data/slippage.jsonl`, JSON.stringify({ ticker, slippage: roundedSlippageBps }) + '\n');
}
