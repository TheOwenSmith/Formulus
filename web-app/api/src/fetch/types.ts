export {
  type Bar,
  stringifiedBarSchema,
  tickerSchema,
  timestampSchema,
  type UserTicker,
} from '@shared/trading-constants';
import { tickers } from '@shared/trading-constants';

export type Ticker = (typeof tickers)[number] | (string & {});

// Header
export const tickDataCsvHeader = 'timestamp,open,high,low,close,volume\n';
