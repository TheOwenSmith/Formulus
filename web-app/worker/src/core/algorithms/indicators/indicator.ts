import type { Bar } from '@shared/api';
import {
  maxPeriodByIndicatorByContextLength,
  minPeriodByIndicator,
} from '@shared/indicator-params';
import { MAX_INDICATOR_MULTIPLIER } from '@shared/trading-constants';
import { badRequest, type AppError } from '@worker/utils/error-handling';
import { completeUnionArray } from '@worker/utils/types';
import { err, ok, Result } from 'neverthrow';
import z from 'zod';
import { computeATR } from './atr';
import { computeEMA } from './ema';
import type { IndicatorMetadata, IndicatorMetadataKey } from './indicator-metadata';
import { computeLinearRegression } from './linear-regression';
import { computeRSI } from './rsi';
import { computeSMA } from './sma';
import { computeSuperTrend } from './super-trend';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IndicatorResultByIndicator {}
export type Indicator = keyof IndicatorResultByIndicator;

const indicatorKeys = completeUnionArray<IndicatorMetadataKey>()([
  'ema',
  'sma',
  'rsi',
  'atr',
  'linearRegression',
  'superTrend',
]);

const indicatorKeyToShorthand: Record<IndicatorMetadataKey, string> = {
  atr: 'ATR',
  ema: 'EMA',
  linearRegression: 'LinearRegression',
  rsi: 'RSI',
  sma: 'SMA',
  superTrend: 'SuperTrend',
};

const regexByIndicator = {
  atr: /^ATR\((\d*)\)$/,
  ema: /^EMA\((\d*)\)$/,
  linearRegression: /^LinearRegression\((\d*)\)$/,
  rsi: /^RSI\((\d*)\)$/,
  sma: /^SMA\((\d*)\)$/,
  superTrend: /^SuperTrend\((\d*),(\d*)\)$/,
} satisfies Record<IndicatorMetadataKey, RegExp>;

function isIndicator(inp: string): inp is Indicator {
  return Object.values(regexByIndicator).some((regex) => regex.test(inp));
}
export const indicatorSchema = z
  .string()
  .refine(isIndicator, { message: 'Invalid indicator name' });

export function indicatorsValidationForContextLength(
  indicators: Indicator[],
  contextLength: number,
) {
  for (const indicator of indicators) {
    for (const indicatorKey of indicatorKeys) {
      const matchResult = indicator.match(regexByIndicator[indicatorKey]);
      if (matchResult != null) {
        const period = parseInt(matchResult[1]);
        if (
          period < minPeriodByIndicator[indicatorKey] ||
          maxPeriodByIndicatorByContextLength[indicatorKey](contextLength) < period
        ) {
          return err(
            badRequest(
              `Period must be between ${minPeriodByIndicator[indicatorKey]} and ${maxPeriodByIndicatorByContextLength[indicatorKey](contextLength)} to compute ${indicatorKeyToShorthand[indicatorKey]}(${period})`,
            ),
          );
        }

        if (indicatorKey === 'superTrend') {
          const multiplier = parseInt(matchResult[2]);
          if (multiplier < 1 || MAX_INDICATOR_MULTIPLIER < multiplier) {
            return err(
              badRequest(
                `Multiplier must be between 1 and ${MAX_INDICATOR_MULTIPLIER} to compute SuperTrend(${period},${multiplier})`,
              ),
            );
          }
        }
        continue;
      }
    }
  }
  return ok(true);
}

export function indicatorsToIndicatorResultsFunction(
  indicators: Indicator[],
): Result<
  (
    bars: Bar[],
    metadata: IndicatorMetadata,
  ) => Result<Partial<IndicatorResultByIndicator>, AppError>,
  AppError
> {
  const indicatorFunctionByIndicator: Partial<
    Record<
      Indicator,
      (
        bars: Bar[],
        metadata: IndicatorMetadata,
      ) => Result<IndicatorResultByIndicator[Indicator], AppError>
    >
  > = {};

  for (const indicator of indicators) {
    if (indicator in indicatorFunctionByIndicator) {
      return err(badRequest(`Duplicate indicator: '${indicator}'`));
    }

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
    return err(badRequest(`Unknown indicator: '${indicator}'`));
  }

  return ok(
    (
      bars: Bar[],
      metadata: IndicatorMetadata,
    ): Result<Partial<IndicatorResultByIndicator>, AppError> => {
      const result = {} as Partial<IndicatorResultByIndicator>;
      for (const indicator of indicators) {
        const indicatorFunction = indicatorFunctionByIndicator[indicator];
        if (indicatorFunction != undefined) {
          const indicatorFunctionResult = indicatorFunction(bars, metadata);
          if (indicatorFunctionResult.isErr()) {
            return err(indicatorFunctionResult.error);
          }
          (result as Record<PropertyKey, unknown>)[indicator] = indicatorFunctionResult.value;
        }
      }
      return ok(result);
    },
  );
}
