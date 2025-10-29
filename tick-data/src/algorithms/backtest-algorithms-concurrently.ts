import type { Graph, SimplePlot } from '@/lib/nodeplotlib';
import { formatTable, type SelectionOption } from '@/utils/cli';
import {
  compareDays,
  dateToDay,
  isMarketOpenByEndOfTick,
  millisecondsToTimeString,
  timespanToDays,
  type Day,
} from '@/utils/date-utils';
import { tryAsync, trySync } from '@/utils/errorHandling';
import { countLinesInFile } from '@/utils/file';
import { withCommas, withCommasRounded } from '@/utils/number-utils';
import cliProgress, { Presets } from 'cli-progress';
import { getAggregateDataIterator, type Bar } from './read-data';

export const enum Action {
  BUY,
  SELL,
  HOLD,
}
export type Algorithm = {
  name: string;
  implementation: (context: Bar[], position: number) => Action;
  contextLength: number;
};

export type Slippage = { bps: number } | { constant: number };
export function slippageToString(slippage: Slippage): string {
  return 'bps' in slippage ? slippage.bps.toString() + 'bps' : '$' + slippage.constant.toString();
}

export type Strategy = {
  algorithm: Algorithm;
  slippage?: Slippage;
  alwaysHoldOutsideMarketHours?: boolean;
  doPlot?: boolean;
};

export type TickData = [
  tickerSymbol: string,
  filename: string,
  aggregateInMilliseconds: number,
  weight?: number,
];

type SelectionOptionWithPerformance<T> = SelectionOption<T> & { performance: number };

const MAX_POINTS_PER_PLOT = 1_000;
const PROGRESS_UPDATE_INTERVAL = 1_000;

export async function backtestAlgorithmsConcurrently({
  tickers,
  strategies,
  timespan,
  verboseLogging = false,
  trackProgress = true,
}: {
  tickers: TickData[];
  strategies: Strategy[];
  timespan?: [string, string];
  verboseLogging?: boolean;
  trackProgress?: boolean;
}): Promise<SelectionOption<SelectionOption<Graph>[]>[]> {
  const timespanDates: [Day, Day] | undefined =
    timespan != undefined ? timespanToDays(timespan) : undefined;

  if (verboseLogging && trackProgress) {
    throw new Error('Verbose logging and tracking progress cannot be used together');
  }

  function calculateSlippageDelta(index: number, price: number) {
    const { slippage } = strategies[index];
    if (slippage == undefined) return 0;

    return 'bps' in slippage ? price * (slippage.bps / 10_000) : slippage.constant;
  }

  const balances: number[][] = Array.from({ length: tickers.length }, () =>
    Array(strategies.length).fill(100),
  );
  const positions: number[][] = Array.from({ length: tickers.length }, () =>
    Array(strategies.length).fill(0),
  );
  const trades: number[][] = Array.from({ length: tickers.length }, () =>
    Array(strategies.length).fill(0),
  );
  function closePosition(tickerIndex: number, strategyIndex: number, closePrice: number) {
    // When selling (closing long), you receive the bid price (lower)
    const bidPrice = closePrice - calculateSlippageDelta(strategyIndex, closePrice);
    balances[tickerIndex][strategyIndex] += positions[tickerIndex][strategyIndex] * bidPrice;
    positions[tickerIndex][strategyIndex] = 0;
    trades[tickerIndex][strategyIndex]++;
  }
  function openPosition(
    tickerIndex: number,
    strategyIndex: number,
    closePrice: number,
    isShort: boolean,
  ) {
    // When buying (opening long), you pay the ask price (higher)
    const askPrice = closePrice + calculateSlippageDelta(strategyIndex, closePrice);
    if (isShort)
      positions[tickerIndex][strategyIndex] -= balances[tickerIndex][strategyIndex] / askPrice;
    else positions[tickerIndex][strategyIndex] += balances[tickerIndex][strategyIndex] / askPrice;
    balances[tickerIndex][strategyIndex] = 0;
  }

  function portfolioValue(tickerIndex: number, strategyIndex: number, closePrice: number): number {
    return (
      balances[tickerIndex][strategyIndex] + positions[tickerIndex][strategyIndex] * closePrice
    );
  }

  // Count number of lines that need to be processed
  let totalLines = 0;
  console.log('Counting number of lines to process...');
  for (const [_tickerSymbol, tickDataFilename] of tickers) {
    const getIteratorResponse = await tryAsync(() => countLinesInFile(tickDataFilename));
    if (!getIteratorResponse.ok) {
      throw getIteratorResponse.error;
    }
    const linesInFile = getIteratorResponse.data;
    totalLines += linesInFile;
  }
  console.log(`Total lines to process: ${withCommas(totalLines)}`);

  // Initialize progress bar
  const progressBar = new cliProgress.SingleBar({}, Presets.shades_grey);
  const progressStartTimestamp = Date.now();
  if (trackProgress) {
    progressBar.start(totalLines, 0);
  }

  // Fetch ticker iterators for all tickers
  const tickerIterators: AsyncIterator<Bar, undefined>[] = [];
  for (const [_tickerSymbol, tickDataFilename, _aggregateInMilliseconds] of tickers) {
    if (verboseLogging) {
      console.log(`Fetching ${tickDataFilename}...`);
    }

    const getIteratorResponse = trySync(() =>
      getAggregateDataIterator(tickDataFilename, verboseLogging),
    );
    if (!getIteratorResponse.ok) {
      throw getIteratorResponse.error;
    }
    tickerIterators.push(getIteratorResponse.data);
  }

  // Tracking variables
  const previousTicks: Bar[][] = Array.from({ length: tickers.length }, () => []);
  const firstTicks: (number | null)[] = Array(tickers.length).fill(null);
  const lastTicks: (number | null)[] = Array(tickers.length).fill(null);

  // Plotting variables
  const tickerYs: number[][] = Array.from({ length: tickers.length }, () => []);
  const strategyYs: number[][][] = Array.from({ length: tickers.length }, () =>
    Array.from({ length: strategies.length }, () => []),
  );
  const plotSpacings: number[] = Array(tickers.length).fill(1);
  const lines: number[] = Array(tickers.length).fill(0);
  const graphSelectionOptionsByAlgorithmName = new Map<
    string,
    SelectionOptionWithPerformance<Graph>[]
  >();
  const strategyPerformanceByAlgorithmNameByStrategy = new Map<
    string,
    Map<Strategy, [sum: number, weight: number]>
  >();

  // Calculate maximum context length for all strategies
  let maxContextLength = 0;
  for (const { algorithm } of strategies) {
    maxContextLength = Math.max(maxContextLength, algorithm.contextLength);
  }

  // Buffer one tick ahead to determine market state efficiently
  const nextBars: IteratorResult<Bar, undefined>[] = await Promise.all(
    tickerIterators.map((tickerIterator) => tickerIterator.next()),
  );
  const canTradeNextBar: boolean[] = Array(tickers.length).fill(false);
  for (let tickerIndex = 0; tickerIndex < tickers.length; tickerIndex++) {
    // Pre-calculate market state for the first tick
    if (!nextBars[tickerIndex].done) {
      const aggregateInMilliseconds = tickers[tickerIndex][2];
      canTradeNextBar[tickerIndex] = isMarketOpenByEndOfTick(
        nextBars[tickerIndex].value![0],
        aggregateInMilliseconds,
      );
    }
  }

  let linesProcessed = 0;
  for (let tickerIndex = 0; tickerIndex < tickers.length; tickerIndex++) {
    const aggregateInMilliseconds = tickers[tickerIndex][2];

    while (!nextBars[tickerIndex].done) {
      const currentBar = nextBars[tickerIndex].value!;
      const canTradeCurrentBar = canTradeNextBar[tickerIndex];

      // Get next tick and pre-calculate its market state
      nextBars[tickerIndex] = await tickerIterators[tickerIndex].next();
      if (!nextBars[tickerIndex].done) {
        canTradeNextBar[tickerIndex] = isMarketOpenByEndOfTick(
          nextBars[tickerIndex].value![0],
          aggregateInMilliseconds,
        );
      } else {
        canTradeNextBar[tickerIndex] = false;
      }

      if (trackProgress && ++linesProcessed % PROGRESS_UPDATE_INTERVAL === 0) {
        progressBar.update(linesProcessed);
      }

      // const startTickTimestamp = new Date(etDateStringToTimestamp(currentBar[0]));
      // const endTickTimestamp = new Date(startTickTimestamp.getTime() + aggregateInMilliseconds);
      const currentBarDay = dateToDay(currentBar[0]);
      if (timespanDates != undefined && compareDays(currentBarDay, timespanDates[0]) < 0) {
        continue;
      }
      if (timespanDates != undefined && compareDays(currentBarDay, timespanDates[1]) > 0) {
        break;
      }

      // Skip if market is closed for this tick
      if (!canTradeCurrentBar) continue;

      if (lines[tickerIndex] % plotSpacings[tickerIndex] === 0) {
        tickerYs[tickerIndex].push((currentBar[4] / firstTicks[tickerIndex]!) * 100);
        for (let i = 0; i < strategies.length; i++) {
          if (strategies[i].doPlot ?? false) {
            strategyYs[tickerIndex][i].push(portfolioValue(tickerIndex, i, currentBar[4]));
          }
        }

        if (tickerYs[tickerIndex].length > MAX_POINTS_PER_PLOT) {
          // Reduce the number of points in the plot by half
          const reducedTickerPlot: number[] = [];
          for (let j = 0; j < tickerYs[tickerIndex].length; j += 2) {
            reducedTickerPlot.push(tickerYs[tickerIndex][j]);
          }
          tickerYs[tickerIndex] = reducedTickerPlot;

          for (let strategyIndex = 0; strategyIndex < strategies.length; strategyIndex++) {
            if (strategies[strategyIndex].doPlot ?? false) {
              const reducedStrategyPlot: number[] = [];
              for (let j = 0; j < strategyYs[tickerIndex][strategyIndex].length; j += 2) {
                reducedStrategyPlot.push(strategyYs[tickerIndex][strategyIndex][j]);
              }
              strategyYs[tickerIndex][strategyIndex] = reducedStrategyPlot;
            }
          }
          plotSpacings[tickerIndex] *= 2;
        }
      }
      lines[tickerIndex]++;

      // Update tracking variables
      if (firstTicks[tickerIndex] == null) firstTicks[tickerIndex] = currentBar[1];
      lastTicks[tickerIndex] = currentBar[4];

      if (previousTicks[tickerIndex].length < maxContextLength) {
        previousTicks[tickerIndex].push(currentBar);
      } else {
        previousTicks[tickerIndex].shift();
        previousTicks[tickerIndex].push(currentBar);
      }

      // If context length is not met, skip the tick
      if (previousTicks[tickerIndex].length < maxContextLength) {
        continue;
      }

      // Process each strategy
      for (let strategyIndex = 0; strategyIndex < strategies.length; strategyIndex++) {
        const { algorithm, alwaysHoldOutsideMarketHours = false } = strategies[strategyIndex];

        let action: Action;
        if (!canTradeNextBar[tickerIndex] && alwaysHoldOutsideMarketHours) {
          action = Action.BUY;
        } else {
          action = algorithm.implementation(
            previousTicks[tickerIndex].slice(-algorithm.contextLength),
            positions[tickerIndex][strategyIndex],
          );
        }
        const closePrice = currentBar[4];
        if (action === Action.HOLD) {
          continue;
        }

        if (positions[tickerIndex][strategyIndex] === 0 && action === Action.BUY) {
          // buy to open
          openPosition(tickerIndex, strategyIndex, closePrice, false);
          continue;
        }

        if (positions[tickerIndex][strategyIndex] !== 0 && action === Action.SELL) {
          // sell to close
          closePosition(tickerIndex, strategyIndex, closePrice);
        }
      }
    }

    // Calculate ticker return and final balance
    const tickerReturn =
      firstTicks[tickerIndex] && lastTicks[tickerIndex]
        ? ((lastTicks[tickerIndex]! - firstTicks[tickerIndex]!) / firstTicks[tickerIndex]!) * 100
        : 0;
    const tickerFinalBalance =
      firstTicks[tickerIndex] && lastTicks[tickerIndex]
        ? 100 * (lastTicks[tickerIndex]! / firstTicks[tickerIndex]!)
        : 100;

    for (let strategyIndex = 0; strategyIndex < strategies.length; strategyIndex++) {
      if (positions[tickerIndex][strategyIndex] !== 0) {
        closePosition(tickerIndex, strategyIndex, previousTicks[tickerIndex].at(-1)![4]);
      }
    }

    const xs = Array.from({ length: tickerYs[tickerIndex].length }, (_, i) => i);
    const tickerPlot: SimplePlot = {
      name: 'Ticker',
      x: xs,
      y: tickerYs[tickerIndex],
      type: 'scatter',
    };

    const aggregateTimeString = millisecondsToTimeString(aggregateInMilliseconds);
    const tickerWeight = tickers[tickerIndex][3] ?? 1;
    for (let strategyIndex = 0; strategyIndex < strategies.length; strategyIndex++) {
      const {
        algorithm,
        slippage = { bps: 0 },
        alwaysHoldOutsideMarketHours = false,
        doPlot = false,
      } = strategies[strategyIndex];
      if (doPlot) {
        if (strategyYs[tickerIndex][strategyIndex].length === 0) {
          console.error(`No strategy data for ${algorithm.name}`);
          continue;
        }

        // Construct plot
        const strategyPlot: SimplePlot = {
          name: 'Strategy',
          x: xs,
          y: strategyYs[tickerIndex][strategyIndex],
          type: 'scatter',
        };

        // Plotting statistics
        const tickerSymbol = tickers[tickerIndex][0];
        const strategyToTickerReturn =
          (balances[tickerIndex][strategyIndex] - 100) / (tickerFinalBalance - 100);

        const description: string[] = [
          `Ticker: ${tickers[tickerIndex][0]}`,
          `Aggregate: ${aggregateTimeString}`,
          `Slippage: ${slippageToString(slippage)}`,
          `Hold after hours: ${alwaysHoldOutsideMarketHours ? 'Yes' : 'No'}`,
          `Ticker return: ${withCommasRounded(tickerReturn)}%`,
          `Trades made: ${withCommas(trades[tickerIndex][strategyIndex])}`,
          `Strategy return: ${withCommasRounded(balances[tickerIndex][strategyIndex] - 100)}%`,
          `Strategy/ticker return: ${withCommasRounded(strategyToTickerReturn)}x`,
        ];

        if (!graphSelectionOptionsByAlgorithmName.has(algorithm.name)) {
          graphSelectionOptionsByAlgorithmName.set(algorithm.name, []);
        }
        const algorithmGraphOptions: SelectionOptionWithPerformance<Graph>[] =
          graphSelectionOptionsByAlgorithmName.get(algorithm.name)!;

        // Add plot to selection options indexed by algorithm
        algorithmGraphOptions.push({
          name: [
            tickerSymbol,
            slippageToString(slippage),
            ...(alwaysHoldOutsideMarketHours ? ['Hold after Hours'] : []),
            withCommasRounded(strategyToTickerReturn) + 'x',
          ].join('; '),
          value: {
            tickerPlot,
            strategyPlot,
            algorithmName: algorithm.name,
            description,
          },
          performance: strategyToTickerReturn,
        });

        // Update algorithm performance
        if (!strategyPerformanceByAlgorithmNameByStrategy.has(algorithm.name)) {
          strategyPerformanceByAlgorithmNameByStrategy.set(
            algorithm.name,
            new Map<Strategy, [sum: number, weight: number]>(),
          );
        }

        const currentPerformance: [sum: number, weight: number] =
          strategyPerformanceByAlgorithmNameByStrategy
            .get(algorithm.name)!
            .get(strategies[strategyIndex]) ?? [0, 0];
        const newPerformanceSum = currentPerformance[0] + tickerWeight * strategyToTickerReturn;
        const newPerformanceWeight = currentPerformance[1] + tickerWeight;

        strategyPerformanceByAlgorithmNameByStrategy
          .get(algorithm.name)!
          .set(strategies[strategyIndex], [newPerformanceSum, newPerformanceWeight]);
      }
    }
  }

  const graphSelectionOptionsByAlgorithmResult: SelectionOptionWithPerformance<
    SelectionOption<Graph>[]
  >[] = [];
  for (const algorithmName of graphSelectionOptionsByAlgorithmName.keys()) {
    // Compile statistics
    let strategiesPerformanceSum = 0;
    let strategiesCount = 0;
    let maxStrategyPerformance = 0;
    let minStrategyPerformance = 0;
    for (const [
      strategyPerformanceSum,
      strategyPerformanceWeight,
    ] of strategyPerformanceByAlgorithmNameByStrategy.get(algorithmName)!.values()) {
      if (strategyPerformanceWeight !== 0) {
        const strategyPerformanceMetric = strategyPerformanceSum / strategyPerformanceWeight;
        strategiesPerformanceSum += strategyPerformanceMetric;
        strategiesCount++;
        minStrategyPerformance = Math.min(minStrategyPerformance, strategyPerformanceMetric);
        maxStrategyPerformance = Math.max(maxStrategyPerformance, strategyPerformanceMetric);
      }
    }

    // Sort graphs by performance
    const algorithmGraphOptions = graphSelectionOptionsByAlgorithmName.get(algorithmName)!;
    algorithmGraphOptions.sort((a, b) => b.performance - a.performance);

    graphSelectionOptionsByAlgorithmResult.push({
      name: `${algorithmName}; ${withCommasRounded(maxStrategyPerformance)}`,
      value: algorithmGraphOptions,
      performance: maxStrategyPerformance,
    });
  }

  // Sort algorithms by performance
  graphSelectionOptionsByAlgorithmResult.sort((a, b) => b.performance - a.performance);

  if (trackProgress) {
    progressBar.update(totalLines);
    progressBar.stop();
    console.log(`Time taken: ${withCommas(Date.now() - progressStartTimestamp)}ms`);
  }
  return graphSelectionOptionsByAlgorithmResult;
}

export function getBacktestStatistics({
  algorithmName,
  slippage = { bps: 0 },
  alwaysHoldOutsideMarketHours = false,
  filename,
  aggregateInMilliseconds,
  trades,
  balance,
  tickerReturn,
  tickerFinalBalance,
}: {
  algorithmName: string;
  slippage?: Slippage;
  alwaysHoldOutsideMarketHours?: boolean;
  filename: string;
  aggregateInMilliseconds: number;
  trades: number;
  balance: number;
  tickerReturn: number;
  tickerFinalBalance: number;
}) {
  const table: [string, string][] = [];
  table.push(['Algorithm', algorithmName]);
  table.push(['Aggregate', millisecondsToTimeString(aggregateInMilliseconds)]);
  table.push(['Slippage', slippageToString(slippage)]);
  table.push(['Hold after hours', alwaysHoldOutsideMarketHours ? 'Yes' : 'No']);
  table.push(['Ticker return', withCommasRounded(tickerReturn) + '%']);
  table.push(['Ticker final balance', '$' + withCommasRounded(tickerFinalBalance)]);
  table.push(['Trades made', withCommas(trades)]);
  table.push(['Strategy final balance', '$' + withCommasRounded(balance)]);
  table.push(['Strategy return', withCommasRounded(balance - 100) + '%']);
  table.push([
    'Strategy/ticker return',
    withCommasRounded((balance - 100) / (tickerFinalBalance - 100)) + 'x',
  ]);

  let statistics = '';
  statistics += `--- Backtest Summary (${filename}) ---` + '\n';
  statistics += formatTable(table);
  statistics += '------------------------' + '\n';
  return statistics;
}
