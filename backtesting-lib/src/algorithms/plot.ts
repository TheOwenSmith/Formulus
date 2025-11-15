import { plotStrategy, type Graph } from '@/lib/nodeplotlib';
import { getUserSelectionInput, UserExitEarlyError, type SelectionOption } from '@/utils/cli';
import { tryAsync } from '@/utils/errorHandling';

export async function chooseToPlot(
  header: string,
  graphSelectionOptions: SelectionOption<Graph>[],
) {
  let serverIsUp = false;
  while (graphSelectionOptions.length > 0) {
    const strategyGraphSelectionResponse = await tryAsync(() =>
      getUserSelectionInput({
        header,
        options: graphSelectionOptions,
        message: 'Select which plot to display:',
        quitMessage: 'Quit (do not display any plot)',
        allMessage: 'All (display all plots)',
      }),
    );
    if (!strategyGraphSelectionResponse.ok) throw strategyGraphSelectionResponse.error;
    const strategyGraphSelection = strategyGraphSelectionResponse.data;

    if (strategyGraphSelection == null) {
      // User chose to not display any graphs, so return early
      return;
    }

    if (strategyGraphSelection === 'all') {
      for (const graphOption of graphSelectionOptions) {
        plotStrategy(graphOption.value);
      }
      return;
    }

    // Remove the selected strategy graph from the list of options
    const removeIndex = graphSelectionOptions.findIndex(
      (option) => option.value === strategyGraphSelection,
    );
    graphSelectionOptions.splice(removeIndex, 1);

    plotStrategy(strategyGraphSelection);
    if (!serverIsUp) {
      await new Promise((resolve) => setTimeout(resolve, 2_500));
      serverIsUp = true;
    }
  }
}

export async function chooseToPlotByAlgorithm(
  graphSelectionOptionsByAlgorithm: SelectionOption<SelectionOption<Graph>[]>[],
) {
  while (graphSelectionOptionsByAlgorithm.length > 0) {
    const graphSelectionOptionsResponse = await tryAsync(() =>
      getUserSelectionInput({
        options: graphSelectionOptionsByAlgorithm,
        message: 'Select an algorithm to view backtesting results for:',
        quitMessage: 'Quit (do not view any backtesting results)',
      }),
    );
    if (!graphSelectionOptionsResponse.ok) {
      if (graphSelectionOptionsResponse.error instanceof UserExitEarlyError) {
        console.error('User did not select an algorithm');
        return;
      }
      throw graphSelectionOptionsResponse.error;
    }
    const graphSelectionOptions = graphSelectionOptionsResponse.data;

    if (graphSelectionOptions == null) {
      // User chose to not view backtesting results for an algorithm, so return early
      return;
    }

    // Remove the selected algorithm from the list of options
    const removeIndex = graphSelectionOptionsByAlgorithm.findIndex(
      (option) => option.value === graphSelectionOptions,
    );
    const [selectedOption] = graphSelectionOptionsByAlgorithm.splice(removeIndex, 1);
    const selectedAlgorithmName = selectedOption.name;

    graphSelectionOptions.sort((a, b) => {
      const aLastX = a.value.strategyPlot.y.at(-1) ?? 0;
      const bLastX = b.value.strategyPlot.y.at(-1) ?? 0;
      return bLastX - aLastX;
    });

    const chooseToPlotGraphResponse = await tryAsync(() =>
      chooseToPlot(
        `Viewing backtesting results for algorithm ${selectedAlgorithmName}`,
        graphSelectionOptions,
      ),
    );
    if (!chooseToPlotGraphResponse.ok) {
      if (chooseToPlotGraphResponse.error instanceof UserExitEarlyError) {
        console.error('User did not select a graph to plot');
        return;
      }
      throw chooseToPlotGraphResponse.error;
    }
  }
}
