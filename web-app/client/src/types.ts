export type Plot = {
  name: string;
  y: number[];
};

export type Graph = {
  tickerPlot: Plot;
  algorithmPlot: Plot;
  algorithmName: string;
  description: string[];
  timestamps: string[];
};

