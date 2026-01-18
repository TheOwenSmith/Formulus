import type { SupportedLanguage } from '@api/core/backtesting/rpc/create-rpc-function';
import { getTickers } from '@api/core/backtesting/ticker-utils';
import type { tickers, Timestamp, UserTicker } from '@api/fetch/types';
import {
  AlgorithmType as DbAlgorithmType,
  Timestamp as DbTimestamp,
} from '@api/generated/prisma/enums';
import type { AlgorithmModel } from '@api/generated/prisma/models/Algorithm';
import { prisma } from '@api/lib/prisma';
import { ErrorWithCode, tryAsync } from '@api/utils/error-handling';
import type { Indicator } from './indicators/indicator';
import { AlgorithmType, type AnyUserAlgorithmType } from './user-algorithm';

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

function convertAlgorithmTypeToDbAlgorithmType(algorithmType: AlgorithmType): DbAlgorithmType {
  switch (algorithmType) {
    case AlgorithmType.NORMAL:
      return DbAlgorithmType.NORMAL;
    case AlgorithmType.SIMPLE:
      return DbAlgorithmType.SIMPLE;
    case AlgorithmType.TOP_K:
      return DbAlgorithmType.TOP_K;
    default: {
      const _exhaustiveCheck: never = algorithmType;
      return _exhaustiveCheck;
    }
  }
}

function convertDbAlgorithmTypeToAlgorithmType(dbAlgorithmType: DbAlgorithmType): AlgorithmType {
  switch (dbAlgorithmType) {
    case DbAlgorithmType.NORMAL:
      return AlgorithmType.NORMAL;
    case DbAlgorithmType.SIMPLE:
      return AlgorithmType.SIMPLE;
    case DbAlgorithmType.TOP_K:
      return AlgorithmType.TOP_K;
    default: {
      const _exhaustiveCheck: never = dbAlgorithmType;
      return _exhaustiveCheck;
    }
  }
}

export async function uploadAlgorithm({
  algorithm,
  creatorId,
}: {
  algorithm: AnyUserAlgorithmType;
  creatorId: string;
}): Promise<AlgorithmModel> {
  if (algorithm.type === AlgorithmType.TOP_K && !('k' in algorithm)) {
    throw new ErrorWithCode(
      'Failed to upload algorithm: k is required for TOP_K algorithms',
      'BAD_REQUEST',
    );
  }

  const createAlgorithmResponse = await tryAsync(() =>
    prisma.algorithm.create({
      data: {
        aggregate: convertTimestampToDbTimestamp(algorithm.aggregate),
        algorithmMaxHoldingProportion: algorithm.algorithmMaxHoldingProportion,
        contextLength: algorithm.contextLength,
        creator: {
          connect: {
            id: creatorId,
          },
        },
        indicators: algorithm.indicators ?? [],
        k: 'k' in algorithm ? algorithm.k : undefined,
        language: algorithm.language,
        name: algorithm.name,
        tickers: getTickers(algorithm),
        type: convertAlgorithmTypeToDbAlgorithmType(algorithm.type),
        userAlgorithmImplementationCode: algorithm.userAlgorithmImplementationCode,
      },
    }),
  );
  if (!createAlgorithmResponse.ok) {
    throw new ErrorWithCode(createAlgorithmResponse.error, 'INTERNAL_SERVER_ERROR');
  }
  return createAlgorithmResponse.data;
}

export async function retrieveAlgorithmById(id: string): Promise<AnyUserAlgorithmType | null> {
  const getDbAlgorithmResponse = await tryAsync(() =>
    prisma.algorithm.findUnique({
      where: {
        id,
      },
    }),
  );
  if (!getDbAlgorithmResponse.ok) {
    throw new ErrorWithCode(getDbAlgorithmResponse.error, 'INTERNAL_SERVER_ERROR');
  }
  const dbAlgorithm = getDbAlgorithmResponse.data;

  if (dbAlgorithm == null) {
    return null;
  }
  switch (dbAlgorithm.type) {
    case DbAlgorithmType.NORMAL:
      return {
        aggregate: convertDbTimestampToTimestamp(dbAlgorithm.aggregate),
        algorithmMaxHoldingProportion: dbAlgorithm.algorithmMaxHoldingProportion ?? undefined,
        contextLength: dbAlgorithm.contextLength,
        indicators: dbAlgorithm.indicators as Indicator[],
        language: dbAlgorithm.language as SupportedLanguage,
        name: dbAlgorithm.name,
        tickers: dbAlgorithm.tickers as (typeof tickers)[number][],
        type: convertDbAlgorithmTypeToAlgorithmType(dbAlgorithm.type),
        userAlgorithmImplementationCode: dbAlgorithm.userAlgorithmImplementationCode,
      };
    case DbAlgorithmType.SIMPLE:
      return {
        aggregate: convertDbTimestampToTimestamp(dbAlgorithm.aggregate),
        algorithmMaxHoldingProportion: dbAlgorithm.algorithmMaxHoldingProportion ?? undefined,
        contextLength: dbAlgorithm.contextLength,
        indicators: dbAlgorithm.indicators as Indicator[],
        language: dbAlgorithm.language as SupportedLanguage,
        name: dbAlgorithm.name,
        tickers: dbAlgorithm.tickers as UserTicker[],
        type: convertDbAlgorithmTypeToAlgorithmType(dbAlgorithm.type),
        userAlgorithmImplementationCode: dbAlgorithm.userAlgorithmImplementationCode,
      };
    case DbAlgorithmType.TOP_K:
      return {
        aggregate: convertDbTimestampToTimestamp(dbAlgorithm.aggregate),
        algorithmMaxHoldingProportion: dbAlgorithm.algorithmMaxHoldingProportion ?? undefined,
        contextLength: dbAlgorithm.contextLength,
        indicators: dbAlgorithm.indicators as Indicator[],
        k: dbAlgorithm.k!,
        language: dbAlgorithm.language as SupportedLanguage,
        name: dbAlgorithm.name,
        tickers: dbAlgorithm.tickers as UserTicker[],
        type: convertDbAlgorithmTypeToAlgorithmType(dbAlgorithm.type),
        userAlgorithmImplementationCode: dbAlgorithm.userAlgorithmImplementationCode,
      };
    default: {
      const _exhaustiveCheck: never = dbAlgorithm.type;
      return _exhaustiveCheck;
    }
  }
}
