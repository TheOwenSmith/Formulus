import { plot } from 'nodeplotlib';

export type SimplePlot = {
  name: string;
  x: number[];
  y: number[];
  type: 'scatter';
};

export type Graph = {
  tickerPlot: SimplePlot;
  strategyPlot: SimplePlot;
  algorithmName: string;
  description: string[];
};

export async function plotStrategy({
  tickerPlot,
  strategyPlot,
  algorithmName,
  description,
}: Graph) {
  plot([tickerPlot, strategyPlot], {
    title: algorithmName,
    xaxis: { title: 'Time Points' },
    yaxis: { title: 'Portfolio Value ($)' },
    annotations: [
      {
        bgcolor: 'rgba(255,255,255,0.8)',
        bordercolor: 'rgba(0,0,0,0.3)',
        borderwidth: 1,
        showarrow: false,
        text: description.join('<br>'),
        x: 0.02,
        xref: 'paper',
        y: 0.98,
        yref: 'paper',
      },
    ],
  });
}
