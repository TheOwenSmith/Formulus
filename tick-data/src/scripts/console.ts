import { fetchAlphaVantageData, type Ticker } from '@/fetch/alpha-vantage/fetch';
import { optimizeTickDataFile } from '@/fetch/alpha-vantage/optimize';

const tickers: Ticker[] = []; //['SPY', 'SPUU', 'SPXL', 'SH', 'SDS', 'SPXU'];
for (const ticker of tickers) {
  await fetchAlphaVantageData({
    ticker,
    years: 20,
    timestamp: '60min',
    writeToFile: `./data/${ticker}_60min.optimized.csv`,
    isOptimized: true,
  });
}

for (const tickDataFilename of [
  './data/SPY_60min.csv',
  './data/SPUU_60min.csv',
  './data/SPXL_60min.csv',
  './data/SH_60min.csv',
  './data/SDS_60min.csv',
  './data/SPXU_60min.csv',
]) {
  await optimizeTickDataFile(
    tickDataFilename,
    tickDataFilename.replace('.csv', '.optimized.csv'),
    3_600_000,
  );
}
