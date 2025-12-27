export type Plot = {
  name: string;
  y: number[];
};

export type Graph = {
  tickerPlots: Record<string, Plot>; // Multiple tickers, keyed by ticker symbol
  algorithmPlots: Record<string, Plot>; // Multiple algorithms, keyed by algorithm name
  description: string[];
  timestamps: string[];
  growthRate: number; // As a decimal (e.g., 0.385 for 38.5%) - this is now the best algorithm's growth rate
  sharpeRatio: number | null; // Sharpe ratio (can be null if not calculated) - this is now the best algorithm's sharpe ratio
  // Legacy support - if tickerPlot exists, it will be used as default
  tickerPlot?: Plot;
  // Legacy support - if algorithmPlot exists, it will be converted to algorithmPlots
  algorithmPlot?: Plot;
  algorithmName?: string; // Legacy support - kept for backward compatibility
};
