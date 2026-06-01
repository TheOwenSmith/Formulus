import type { Ticker, Timestamp } from '@shared/constants/trading';
import type { AtLeastOne } from '@worker/utils/types';

export const MAX_POINTS_PER_PLOT = 1_000;
export const BYTES_PROGRESS_UPDATE_INTERVAL = 50_000;
export type TickerData = {
  ticker: Ticker;
  aggregate: Timestamp;
} & AtLeastOne<{
  filename: string;
  index: string;
}>;
