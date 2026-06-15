export const BASIC_PLAN_MAX_ALGORITHMS_COUNT = 10;
export const PRO_PLAN_MAX_ALGORITHMS_COUNT = 500;

export const BASIC_PLAN_MAX_CONCURRENT_BACKTESTS = 3;
export const PRO_PLAN_MAX_CONCURRENT_BACKTESTS = 10;

export const MAX_ALGORITHMS_TO_COMPARE = 25;
export const MAX_INDICATORS_COUNT = 40;
export const MAX_INDICATOR_MULTIPLIER = 20;

export const BASIC_PLAN_MAX_BACKTESTS_PER_MONTH = 3;
export const PRO_PLAN_MAX_BACKTESTS_PER_MONTH = 100;

export class LimitReachedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LimitReachedError';
  }
}
