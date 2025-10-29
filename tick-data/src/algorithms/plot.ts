import { plotStrategy, type Graph } from '@/lib/nodeplotlib';
import { getUserSelectionInput, type SelectionOption } from '@/utils/cli';

export async function chooseToPlot(graphSelectionOptions: SelectionOption<Graph>[]) {
  let serverIsUp = false;
  while (graphSelectionOptions.length > 0) {
    const strategyGraphSelection = await getUserSelectionInput({
      options: graphSelectionOptions,
      message: 'Select which strategy plot to display:',
      quitMessage: 'Quit (do not display any plot)',
      allMessage: 'All (Display all plots)',
      errorMessage: 'User did not select a strategy to plot',
    });

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
    const graphSelectionOptions = await getUserSelectionInput({
      options: graphSelectionOptionsByAlgorithm,
      message: 'Select an algorithm to view backtesting results for:',
      quitMessage: 'Quit (do not display any plot)',
      errorMessage: 'User did not select an algorithm',
    });

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

    console.log(`Viewing backtesting results for algorithm ${selectedAlgorithmName}`);
    await chooseToPlot(graphSelectionOptions);
  }
}
