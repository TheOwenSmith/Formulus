import type { Bar } from '@api/fetch/types';
import { ErrorWithCode } from '@api/utils/error-handling';
import z from 'zod';
import { computeATR } from './atr';
import { computeEMA } from './ema';
import type { IndicatorMetadata } from './indicator-metadata';
import { computeLinearRegression } from './linear-regression';
import { computeRSI } from './rsi';
import { computeSMA } from './sma';
import { computeSuperTrend } from './super-trend';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IndicatorResultByIndicator {}

export type Indicator = keyof IndicatorResultByIndicator;

const regexByIndicator = {
  atr: /^ATR\((\d*)\)$/,
  ema: /^EMA\((\d*)\)$/,
  linearRegression: /^LinearRegression\((\d*)\)$/,
  rsi: /^RSI\((\d*)\)$/,
  sma: /^SMA\((\d*)\)$/,
  superTrend: /^SuperTrend\((\d*),(\d*)\)$/,
} satisfies Record<string, RegExp>;

function isIndicator(inp: string): inp is Indicator {
  return Object.values(regexByIndicator).some((regex) => regex.test(inp));
}
export const indicatorSchema = z
  .string()
  .refine(isIndicator, { message: 'Invalid indicator name' });

export function indicatorsToIndicatorResultsFunction(
  indicators: Indicator[],
): (bars: Bar[], metadata: IndicatorMetadata) => Partial<IndicatorResultByIndicator> {
  const indicatorFunctionByIndicator: Partial<
    Record<
      Indicator,
      (bars: Bar[], metadata: IndicatorMetadata) => IndicatorResultByIndicator[Indicator]
    >
  > = {};

  for (const indicator of indicators) {
    const emaMatchResult = indicator.match(regexByIndicator.ema);
    if (emaMatchResult != null) {
      const period = parseInt(emaMatchResult[1]);
      indicatorFunctionByIndicator[indicator] = (bars: Bar[], metadata: IndicatorMetadata) =>
        computeEMA({
          bars,
          period,
          metadata,
        });
      continue;
    }

    const smaMatchResult = indicator.match(regexByIndicator.sma);
    if (smaMatchResult != null) {
      const period = parseInt(smaMatchResult[1]);
      indicatorFunctionByIndicator[indicator] = (bars: Bar[], metadata: IndicatorMetadata) =>
        computeSMA({
          bars,
          period,
          metadata,
        });
      continue;
    }

    const rsiMatchResult = indicator.match(regexByIndicator.rsi);
    if (rsiMatchResult != null) {
      const period = parseInt(rsiMatchResult[1]);
      indicatorFunctionByIndicator[indicator] = (bars: Bar[], metadata: IndicatorMetadata) =>
        computeRSI({
          bars,
          period,
          metadata,
        });
      continue;
    }

    const atrMatchResult = indicator.match(regexByIndicator.atr);
    if (atrMatchResult != null) {
      const period = parseInt(atrMatchResult[1]);
      indicatorFunctionByIndicator[indicator] = (bars: Bar[], metadata: IndicatorMetadata) =>
        computeATR({
          bars,
          period,
          metadata,
        });
      continue;
    }

    const linearRegressionMatchResult = indicator.match(regexByIndicator.linearRegression);
    if (linearRegressionMatchResult != null) {
      const period = parseInt(linearRegressionMatchResult[1]);
      indicatorFunctionByIndicator[indicator] = (bars: Bar[], metadata: IndicatorMetadata) =>
        computeLinearRegression({
          bars,
          period,
          metadata,
        });
      continue;
    }

    const superTrendMatchResult = indicator.match(regexByIndicator.superTrend);
    if (superTrendMatchResult != null) {
      const period = parseInt(superTrendMatchResult[1]);
      const multiplier = parseInt(superTrendMatchResult[2]);
      indicatorFunctionByIndicator[indicator] = (bars: Bar[], metadata: IndicatorMetadata) =>
        computeSuperTrend({
          bars,
          period,
          multiplier,
          metadata,
        });
      continue;
    }
    throw new ErrorWithCode(`Unknown indicator: '${indicator}'`, 'BAD_REQUEST');
  }

  return (bars: Bar[], metadata: IndicatorMetadata) => {
    const result = {} as Partial<IndicatorResultByIndicator>;
    for (const indicator of indicators) {
      const indicatorFunction = indicatorFunctionByIndicator[indicator];
      if (indicatorFunction != undefined) {
        (result as Record<PropertyKey, unknown>)[indicator] = indicatorFunction(bars, metadata);
      }
    }
    return result;
  };
}
