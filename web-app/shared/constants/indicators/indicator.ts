import type { IndicatorMetadataKey } from '@shared/constants/indicators/indicator-metadata';
import { completeUnionArray } from '@shared/utils/types';
import z from 'zod';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IndicatorResultByIndicator {}
export type Indicator = keyof IndicatorResultByIndicator;

export const indicatorKeys = completeUnionArray<IndicatorMetadataKey>()([
  'ema',
  'sma',
  'rsi',
  'atr',
  'linearRegression',
  'superTrend',
]);

export const regexByIndicator = {
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
