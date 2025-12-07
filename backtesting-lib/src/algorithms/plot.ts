import type { Timestamp } from '@/fetch/fetch';
import { plotAlgorithm, type SimplePlot } from '@/lib/nodeplotlib';
import { getUserSelectionInput, UserExitEarlyError, type SelectionOption } from '@/utils/cli';
import { tryAsync } from '@/utils/errorHandling';

const DESCRIPTION_METRICS_ORDER = [
  'aggregate',
  'timespan',
  'algorithmReturn',
  'growthRate',
  'sharpeRatio',
  'profitLossRatio',
  'winRate',
  'tickers',
  'maxHoldingPercentage',
  'contextLength',
  'positionsClosed',
  'tradesMade',
] as const satisfies string[];

export type DescriptionMetrics = {
  [K in (typeof DESCRIPTION_METRICS_ORDER)[number]]: string;
};

type DescriptionMetricOptions = {
  [K in (typeof DESCRIPTION_METRICS_ORDER)[number]]: boolean;
};

const DEFAULT_DESCRIPTION_METRIC_OPTIONS: DescriptionMetricOptions = {
  aggregate: true,
  algorithmReturn: true,
  contextLength: false,
  growthRate: true,
  maxHoldingPercentage: false,
  positionsClosed: true,
  profitLossRatio: false,
  sharpeRatio: true,
  tickers: true,
  timespan: true,
  tradesMade: false,
  winRate: true,
};

let serverIsUp = false;
export async function chooseToPlot(
  algorithmGraphSelectionOptions: SelectionOption<{
    name: string;
    aggregate: Timestamp;
    descriptionMetrics: DescriptionMetrics;
    algorithmPlot: SimplePlot;
  }>[],
  tickerGraphSelectionOptionsByAggregate: Record<Timestamp, SelectionOption<SimplePlot>[]>,
  descriptionMetricOptions: Partial<DescriptionMetricOptions> = DEFAULT_DESCRIPTION_METRIC_OPTIONS,
) {
  while (algorithmGraphSelectionOptions.length > 0) {
    const algorithmSelectionResponse = await tryAsync(() =>
      getUserSelectionInput({
        options: algorithmGraphSelectionOptions,
        message: 'Select an algorithm to view backtesting results for:',
        quitMessage: 'Quit (do not view any backtesting results)',
      }),
    );
    if (!algorithmSelectionResponse.ok) {
      if (algorithmSelectionResponse.error instanceof UserExitEarlyError) {
        console.error('User did not select an algorithm');
        return;
      }
      throw algorithmSelectionResponse.error;
    }
    const selectedAlgorithm = algorithmSelectionResponse.data;

    if (selectedAlgorithm == null) {
      // User chose to not view backtesting results for an algorithm, so return early
      return;
    }

    const { name, algorithmPlot, descriptionMetrics, aggregate } = selectedAlgorithm;

    const tickerSelectionResponse = await tryAsync(() =>
      getUserSelectionInput({
        allMessage: 'All (display all plots)',
        header: `Viewing backtesting results for algorithm '${selectedAlgorithm.name}'`,
        message: 'Select a ticker to plot against the algorithm:',
        options: tickerGraphSelectionOptionsByAggregate[aggregate],
        quitMessage: 'Quit (do not display any plot)',
      }),
    );
    if (!tickerSelectionResponse.ok) {
      if (tickerSelectionResponse.error instanceof UserExitEarlyError) {
        console.error('User did not select a ticker to plot against the algorithm');
        return;
      }
      throw tickerSelectionResponse.error;
    }
    const selectedTicker = tickerSelectionResponse.data;

    if (selectedTicker == null) {
      // User chose to not display any tickers, so reprompt for an algorithm
      continue;
    }

    // Create description
    const description: string[] = [];
    for (const metric of DESCRIPTION_METRICS_ORDER) {
      const showMetric =
        descriptionMetricOptions[metric] ?? DEFAULT_DESCRIPTION_METRIC_OPTIONS[metric];
      if (showMetric) {
        description.push(descriptionMetrics[metric]);
      }
    }

    if (selectedTicker === 'all') {
      for (const tickerPlotSelectionOption of tickerGraphSelectionOptionsByAggregate[aggregate]) {
        await plotAlgorithm({
          tickerPlot: tickerPlotSelectionOption.value,
          algorithmPlot,
          algorithmName: name,
          description,
        });
      }
    } else {
      await plotAlgorithm({
        tickerPlot: selectedTicker,
        algorithmPlot,
        algorithmName: name,
        description,
      });
    }

    // Remove the selected algorithm from the list of options
    const removeIndex = algorithmGraphSelectionOptions.findIndex(
      (option) => option.value === selectedAlgorithm,
    );
    algorithmGraphSelectionOptions.splice(removeIndex, 1);

    // Wait for the server to be up
    if (!serverIsUp) {
      await new Promise((resolve) => setTimeout(resolve, 2_500));
      serverIsUp = true;
    }
  }
}
