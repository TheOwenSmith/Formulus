export type Ticker = 'SPY' | 'SPUU' | 'SPXL' | 'SPX' | 'SH' | 'SDS' | 'SPXU' | (string & {});

export const aggregateTimestamps = ['1min', '5min', '15min', '30min', '60min'] as const;
export type Timestamp = (typeof aggregateTimestamps)[number];

export const tickDataCsvHeader = 'timestamp,open,high,low,close,volume\n';
