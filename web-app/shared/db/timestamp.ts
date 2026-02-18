import { Timestamp } from '@shared/api';
import { Timestamp as DbTimestamp } from '@shared/generated/prisma/enums';

export function convertTimestampToDbTimestamp(timestamp: Timestamp): DbTimestamp {
  switch (timestamp) {
    case '1min':
      return DbTimestamp.min1;
    case '5min':
      return DbTimestamp.min5;
    case '15min':
      return DbTimestamp.min15;
    case '30min':
      return DbTimestamp.min30;
    case '60min':
      return DbTimestamp.min60;
    default: {
      const _exhaustiveCheck: never = timestamp;
      return _exhaustiveCheck;
    }
  }
}

export function convertDbTimestampToTimestamp(timestamp: DbTimestamp): Timestamp {
  switch (timestamp) {
    case DbTimestamp.min1:
      return '1min';
    case DbTimestamp.min5:
      return '5min';
    case DbTimestamp.min15:
      return '15min';
    case DbTimestamp.min30:
      return '30min';
    case DbTimestamp.min60:
      return '60min';
    default: {
      const _exhaustiveCheck: never = timestamp;
      return _exhaustiveCheck;
    }
  }
}
