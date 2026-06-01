export type { Bar, Ticker } from '@shared/constants/trading';
export {
  stringifiedBarSchema,
  tickerSchema,
  timestampSchema,
  type UserTicker,
} from '@shared/schemas/trading';

// Header
export const tickDataCsvHeader = 'timestamp,open,high,low,close,volume\n';
