import { plotStrategy, type Graph } from '@/lib/nodeplotlib';
import { getUserSelectionInput, type SelectionOption } from '@/utils/cli';

export async function chooseToPlot(graphSelectionOptions: SelectionOption<Graph>[]) {
  while (graphSelectionOptions.length > 0) {
    const strategyGraphSelection = await getUserSelectionInput(
      graphSelectionOptions,
      'Select which strategy plot to display:',
      'Quit (do not display any plot)',
    );

    if (strategyGraphSelection == null) {
      // User chose to not display any graphs, so return early
      return;
    }

    // Remove the selected strategy graph from the list of options
    const removeIndex = graphSelectionOptions.findIndex(
      (option) => option.value === strategyGraphSelection,
    );
    graphSelectionOptions.splice(removeIndex, 1);

    plotStrategy(strategyGraphSelection);
  }
}
