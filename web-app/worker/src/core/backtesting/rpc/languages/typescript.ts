import { atrIndicatorResultStringified } from '@shared/constants/indicators/atr';
import { emaIndicatorResultStringified } from '@shared/constants/indicators/ema';
import { linearRegressionIndicatorResultStringified } from '@shared/constants/indicators/linear-regression';
import { rsiIndicatorResultStringified } from '@shared/constants/indicators/rsi';
import { smaIndicatorResultStringified } from '@shared/constants/indicators/sma';
import { superTrendIndicatorResultStringified } from '@shared/constants/indicators/super-trend';

const indicatorResultTypeStrinigifed: string = `interface IndicatorResult {
${[
  atrIndicatorResultStringified,
  emaIndicatorResultStringified,
  linearRegressionIndicatorResultStringified,
  rsiIndicatorResultStringified,
  smaIndicatorResultStringified,
  superTrendIndicatorResultStringified,
].join('\n')}
}`;

export const RUNNER_TS_BATCHED_FROM_FILENAMES = (filenames: string[]) => `
process.stdout.write('compiled\\n');

import type { AlgorithmImplementation } from '@worker/core/algorithms/algorithm';
import readline from 'readline';

async function main() {
  const implementations: AlgorithmImplementation[] = await Promise.all(
    ${JSON.stringify(filenames)}.map(async (filename) => {
      const module = await import(\`/sandbox/\${filename}\`);
      return module.implementation as AlgorithmImplementation;
    }),
  );

  const rl = readline.createInterface({ input: process.stdin });

  rl.on('line', async (line: string) => {
    let msg: any;
    try {
      msg = JSON.parse(line);
    } catch (e) {
      process.stdout.write(
        JSON.stringify({ ok: false, error: e instanceof Error ? e.stack : String(e) }) + '\\n',
      );
      return;
    }

    try {
      const paramsByIndex = msg.args[0];
      const numImplementations = Object.keys(msg.args[0]).length;
      const result =
        numImplementations === 0
          ? {}
          : await new Promise((resolve, reject) => {
              const resultByIndex: Record<string, unknown> = {};
              let notResolvedCount = numImplementations;
              for (const index in paramsByIndex) {
                const indexAsNum = Number(index);
                const params = paramsByIndex[indexAsNum] as Parameters<AlgorithmImplementation>;
                Promise.resolve(implementations[indexAsNum](...params))
                  .then((result) => {
                    resultByIndex[indexAsNum] = result;
                    if (--notResolvedCount === 0) resolve(resultByIndex);
                  })
                  .catch(reject);
              }
            });
      process.stdout.write(JSON.stringify({ ok: true, result }) + '\\n');
    } catch (e) {
      process.stdout.write(
        JSON.stringify({ ok: false, error: e instanceof Error ? e.stack : String(e) }) + '\\n',
      );
    }
  });
}
main().catch((e) => {
  process.stdout.write(
    JSON.stringify({ ok: false, error: e instanceof Error ? e.stack : String(e) }) + '\\n',
  );
});
`;

export const UTILS_TS_CODE = `
export const enum Action {
  BUY = 0,
  SELL = 1,
  HOLD = 2,
}

export const enum Direction {
  UP = 0,
  DOWN = 1,
}

export type Bar = [t: string, o: number, h: number, l: number, c: number, v: number];

export const tickers = [
  'SPY',
  'SSO',
  'SPXL',
  'SH',
  'SDS',
  'SPXU',
  'QQQ',
  'NVDA',
  'TSLA',
  'AMD',
  'META',
  'AAPL',
  'MSFT',
  'AMZN',
  'GOOG',
  'PLTR',
  'SNAP',
  'PFE',
] as const;
export type Ticker = (typeof tickers)[number] | (string & {});

export type AlgorithmImplementation = (
  context: Record<Ticker, Bar[]>,
  positions: Record<Ticker, number>,
  indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
) => Promise<Record<Ticker, Action>>;

${indicatorResultTypeStrinigifed}

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function dayOfWeek(timestamp: number): string {
  const date = new Date(timestamp);
  return DAYS_OF_WEEK[date.getDay()];
}
`;
