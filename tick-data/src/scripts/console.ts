import { fetchAlphaVantageData, type Ticker } from '@/fetch/fetch';

const tickers: Ticker[] = []; //['SPY', 'SPUU', 'SPXL', 'SH', 'SDS', 'SPXU'];
for (const ticker of tickers) {
  await fetchAlphaVantageData({
    ticker,
    years: 20,
    timestamp: '60min',
    writeToFile: `./data/${ticker}_60min.csv`,
  });
}
