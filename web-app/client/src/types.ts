export type Plot = {
  name: string;
  y: number[];
};

export type Graph = {
  tickerPlots: Record<string, Plot>; // Multiple tickers, keyed by ticker symbol
  algorithmPlot: Plot;
  algorithmName: string;
  description: string[];
  timestamps: string[];
  growthRate: number; // As a decimal (e.g., 0.385 for 38.5%)
  sharpeRatio: number | null; // Sharpe ratio (can be null if not calculated)
  // Legacy support - if tickerPlot exists, it will be used as default
  tickerPlot?: Plot;
};
