import type { IndicatorMetadataKey } from '@worker/core/algorithms/indicators/indicator-metadata';

export type { IndicatorMetadataKey } from '@worker/core/algorithms/indicators/indicator-metadata';

export const minPeriodByIndicator: Record<IndicatorMetadataKey, number> = {
  atr: 1,
  ema: 1,
  linearRegression: 2,
  rsi: 1,
  sma: 1,
  superTrend: 1,
};

export const maxPeriodByIndicatorByContextLength: Record<
  IndicatorMetadataKey,
  (contextLength: number) => number
> = {
  atr: (contextLength) => contextLength - 1,
  ema: (contextLength) => contextLength,
  linearRegression: (contextLength) => contextLength - 1,
  rsi: (contextLength) => contextLength,
  sma: (contextLength) => contextLength,
  superTrend: (contextLength) => contextLength - 1,
};
