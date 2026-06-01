import { badRequest } from '@api/utils/error-handling';
import {
  maxPeriodByIndicatorByContextLength,
  minPeriodByIndicator,
  type IndicatorMetadataKey,
} from '@shared/constants/indicator-params';
import {
  indicatorKeys,
  regexByIndicator,
  type Indicator,
} from '@shared/constants/indicators/indicator';
import { MAX_INDICATOR_MULTIPLIER } from '@shared/constants/trading';
import { err, ok } from 'neverthrow';

export const indicatorKeyToShorthand: Record<IndicatorMetadataKey, string> = {
  atr: 'ATR',
  ema: 'EMA',
  linearRegression: 'LinearRegression',
  rsi: 'RSI',
  sma: 'SMA',
  superTrend: 'SuperTrend',
};

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
