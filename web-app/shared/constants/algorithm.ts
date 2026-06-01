import type { AnyUserAlgorithmType } from '@shared/schemas/algorithms/user-algorithm';
import type { Algorithm } from '@worker/core/algorithms/algorithm';
import type { Ticker } from './trading';

export const USER_ALGORITHM_IMPLEMENTATION_CODE_MAX_LENGTH_BYTES = 1024 * 1024; // 1MB
export function getTickers(algorithm: Algorithm | AnyUserAlgorithmType): Ticker[] {
  return 'tickers' in algorithm ? algorithm.tickers : [algorithm.ticker];
}
