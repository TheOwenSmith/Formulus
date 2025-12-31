export type SimplePlot = {
  name: string;
  x: number[];
  y: number[];
  type: 'scatter';
};

export type Graph = {
  tickerPlot: SimplePlot;
  algorithmPlot: SimplePlot;
  algorithmName: string;
  description: string[];
};
