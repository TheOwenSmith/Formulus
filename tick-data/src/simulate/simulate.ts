import { deserializeContextMap } from '@/algorithms/sophisticated-prev-bars';
import type { SimplePlot } from '@/lib/nodeplotlib';
import { trySync } from '@/utils/errorHandling';
import fs from 'fs';
import { plot } from 'nodeplotlib';

export function simulateFromContextMap(
  contextMapFilename: string,
  contextLength: number,
  timespanLength: number,
) {
  const readFileResponse = trySync(() => fs.readFileSync(contextMapFilename, { encoding: 'utf8' }));
  if (!readFileResponse.ok) throw readFileResponse.error;
  const serializedContextMap = readFileResponse.data;

  const contextMapResponse = trySync(() => deserializeContextMap(serializedContextMap));
  if (!contextMapResponse.ok) throw contextMapResponse.error;
  const contextMap = contextMapResponse.data;

  let balance = 100;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < timespanLength; i++) {
    xs.push(i);
    ys.push(balance);

    balance;
  }

  const simulatedPlot: SimplePlot = {
    name: 'Simulation',
    x: xs,
    y: ys,
    type: 'scatter',
  };
  plot([simulatedPlot], {
    title: 'Simulation',
    xaxis: { title: 'Time Points' },
    yaxis: { title: 'Portfolio Value ($)' },
    annotations: [
      {
        x: 0.02,
        y: 0.98,
        xref: 'paper',
        yref: 'paper',
        showarrow: false,
        bgcolor: 'rgba(255,255,255,0.8)',
        bordercolor: 'rgba(0,0,0,0.3)',
        borderwidth: 1,
      },
    ],
  });
}
