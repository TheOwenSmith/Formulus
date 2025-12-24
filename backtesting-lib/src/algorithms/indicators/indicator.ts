import type { Bar } from '@/backtesting/read-data';
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
    const emaMatchResult = indicator.match(/^EMA\((\d*)\)$/);
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

    const smaMatchResult = indicator.match(/^SMA\((\d*)\)$/);
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

    const rsiMatchResult = indicator.match(/^RSI\((\d*)\)$/);
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

    const atrMatchResult = indicator.match(/^ATR\((\d*)\)$/);
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

    const linearRegressionMatchResult = indicator.match(/^LinearRegression\((\d*)\)$/);
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

    const superTrendMatchResult = indicator.match(/^SuperTrend\((\d*),(\d*)\)$/);
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
    throw new Error(`Unknown indicator: '${indicator}'`);
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
