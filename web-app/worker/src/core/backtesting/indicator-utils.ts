import { computeATR } from '@shared/constants/indicators/atr';
import { computeEMA } from '@shared/constants/indicators/ema';
import type { Indicator, IndicatorResultByIndicator } from '@shared/constants/indicators/indicator';
import { regexByIndicator } from '@shared/constants/indicators/indicator';
import type { IndicatorMetadata } from '@shared/constants/indicators/indicator-metadata';
import { computeLinearRegression } from '@shared/constants/indicators/linear-regression';
import { computeRSI } from '@shared/constants/indicators/rsi';
import { computeSMA } from '@shared/constants/indicators/sma';
import { computeSuperTrend } from '@shared/constants/indicators/super-trend';
import type { Bar } from '@shared/constants/trading';
import { badRequest, type AppError } from '@worker/utils/error-handling';
import { err, ok, type Result } from 'neverthrow';

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
