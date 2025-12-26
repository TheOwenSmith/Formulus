import { BacktestVisualization } from './BacktestVisualization';
import type { Graph } from './types';

// Example usage - replace this with your actual data
const sampleData: Graph = {
  algorithmName: 'Momentum Strategy',
  tickerPlot: {
    name: 'SPY',
    y: Array.from({ length: 100 }, (_, i) => {
      const base = 100;
      const trend = i * 0.5;
      const noise = Math.sin(i / 10) * 5 + Math.random() * 3;
      return base + trend + noise;
    }),
  },
  algorithmPlot: {
    name: 'Algorithm',
    y: Array.from({ length: 100 }, (_, i) => {
      const base = 100;
      const trend = i * 0.8;
      const noise = Math.sin(i / 8) * 4 + Math.random() * 2;
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
  timestamps: Array.from({ length: 100 }, (_, i) => {
    const date = new Date('2023-01-01');
    date.setDate(date.getDate() + i * 3);
    return date.toISOString();
  }),
};

export function App() {
  return <BacktestVisualization data={sampleData} />;
}
