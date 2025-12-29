import { Header } from '@client/components/Header';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AboutPage } from './pages/AboutPage';
import { BacktestPage } from './pages/BacktestPage';
import type { Graph } from './types';

const MULTIPLIER = 10;

// Example usage - replace this with your actual data
const generateTickerData = (name: string, baseTrend: number, noiseFactor: number) => ({
  name,
  y: Array.from({ length: 100 * MULTIPLIER }, (_, i) => {
    const base = 100;
    const trend = (i / MULTIPLIER) * baseTrend;
    const noise = Math.sin(i / MULTIPLIER / 10) * noiseFactor + Math.random() * (noiseFactor / 2);
    return base + trend + noise;
  }),
});

// Generate algorithm data with different performance characteristics
const generateAlgorithmData = (
  name: string,
  baseTrend: number,
  volatility: number,
  phase: number,
) => ({
  name,
  y: Array.from({ length: 100 * MULTIPLIER }, (_, i) => {
    const base = 100;
    const trend = (i / MULTIPLIER) * baseTrend;
    const noise =
      Math.sin(i / MULTIPLIER / 8 + phase) * volatility + Math.random() * (volatility / 2);
    return base + trend + noise;
  }),
});

const sampleData: Graph = {
  algorithmPlots: {
    'Momentum Strategy': generateAlgorithmData('Momentum Strategy', 0.12, 4, 0),
    'Mean Reversion': generateAlgorithmData('Mean Reversion', 0.08, 3, Math.PI / 2),
    'Breakout Strategy': generateAlgorithmData('Breakout Strategy', 0.15, 5, Math.PI),
    'RSI Strategy': generateAlgorithmData('RSI Strategy', 0.1, 3.5, Math.PI * 1.5),
  },
  description: [
    'Aggregate: 1min',
    'Timespan: 2023-01-01 to 2024-01-01',
    'Algorithm return: 45.23%',
    'Growth rate: 38.5%',
    'Sharpe ratio: 1.85',
    'Win rate: 62.3%',
    'Profit/loss ratio: 2.5:1',
    'Expectancy per trade: 1.2%',
    'Average holding duration: 125 ticks',
    'Tickers: SPY, AAPL, GOOG',
    'Max holding percentage: 95%',
    'Volatility: 18.5%',
    'Context length: 5',
    'Positions closed: 1,189',
    'Trades made: 1,234',
  ],
  growthRate: 0.22, // Best algorithm's growth rate
  sharpeRatio: 0.9, // Best algorithm's Sharpe ratio
  tickerPlots: {
    SPY: generateTickerData('SPY', 0.1, 5),
    AAPL: generateTickerData('AAPL', 0.15, 6),
    GOOG: generateTickerData('GOOG', 0.08, 4),
  },
  timestamps: Array.from({ length: 100 * MULTIPLIER }, (_, i) => {
    const date = new Date('2023-01-01T09:00:00');
    // Add hours for each data point (simulating minute-by-minute data)
    date.setHours(date.getHours() + i);
    // Format as YYYY-MM-DD HH:mm:ss
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }),
};

export function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/backtest" element={<BacktestPage data={sampleData} />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/" element={<BacktestPage data={sampleData} />} />
      </Routes>
    </BrowserRouter>
  );
}
