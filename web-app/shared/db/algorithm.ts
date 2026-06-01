import { AlgorithmType as DbAlgorithmType } from '@shared/generated/prisma/enums';
import { AlgorithmType } from '@shared/schemas/algorithms/user-algorithm';

export function convertAlgorithmTypeToDbAlgorithmType(
  algorithmType: AlgorithmType,
): DbAlgorithmType {
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

export function convertDbAlgorithmTypeToAlgorithmType(
  dbAlgorithmType: DbAlgorithmType,
): AlgorithmType {
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
