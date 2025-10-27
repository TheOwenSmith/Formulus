import { plotStrategy, type Graph } from '@/lib/nodeplotlib';
import { getUserSelectionInput, type SelectionOption } from '@/utils/cli';
import { tryAsync } from '@/utils/errorHandling';

export async function chooseToPlot(graphSelectionOptions: SelectionOption<Graph>[]) {
  let count = 0;
  while (graphSelectionOptions.length > 0) {
    const strategyGraphSelectionResponse = await tryAsync(() =>
      getUserSelectionInput(
        graphSelectionOptions,
        'Select which strategy plot to display:',
        'Quit (do not display any plot)',
      ),
    );
    if (!strategyGraphSelectionResponse.ok) {
      console.error('User did not select a strategy to plot');
      return;
    }
    const strategyGraphSelection = strategyGraphSelectionResponse.data;

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
    if (++count === 1) {
      await new Promise((resolve) => setTimeout(resolve, 2_500));
    }
  }
}
