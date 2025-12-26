import { BacktestVisualization } from './BacktestVisualization';
import type { Graph } from './types';

const MULTIPLIER = 10;

// Example usage - replace this with your actual data
const sampleData: Graph = {
  algorithmName: 'Momentum Strategy',
  algorithmPlot: {
    name: 'Algorithm',
    y: Array.from({ length: 100 * MULTIPLIER }, (_, i) => {
      const base = 100;
      const trend = (i / MULTIPLIER) * 0.8;
      const noise = Math.sin(i / MULTIPLIER / 8) * 4 + Math.random() * 2;
      return base + trend + noise;
    }),
  },
  description: [
    'Algorithm return: 45.23%',
    'Growth rate: 38.5%',
    'Sharpe ratio: 1.85',
    'Win rate: 62.3%',
    'Timespan: 2023-01-01 to 2024-01-01',
    'Trades made: 1,234',
    'Positions closed: 1,189',
  ],
  tickerPlot: {
    name: 'SPY',
    y: Array.from({ length: 100 * MULTIPLIER }, (_, i) => {
      const base = 100;
      const trend = (i / MULTIPLIER) * 0.5;
      const noise = Math.sin(i / MULTIPLIER / 10) * 5 + Math.random() * 3;
      return base + trend + noise;
    }),
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
  return <BacktestVisualization data={sampleData} />;
}
