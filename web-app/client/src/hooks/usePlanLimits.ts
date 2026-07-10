import { trpcCredentials } from '@client/lib/trpc';
import {
  BASIC_PLAN_MAX_ALGORITHMS_COUNT,
  BASIC_PLAN_MAX_BACKTESTS_PER_MONTH,
  BASIC_PLAN_MAX_CONCURRENT_BACKTESTS,
  PRO_PLAN_MAX_ALGORITHMS_COUNT,
  PRO_PLAN_MAX_BACKTESTS_PER_MONTH,
  PRO_PLAN_MAX_CONCURRENT_BACKTESTS,
} from '@shared/constants/limits';
import { useQuery } from '@tanstack/react-query';

export function usePlanLimits() {
  const { data: userResponse } = useQuery(trpcCredentials.users.getCurrentUser.queryOptions());
  const { data: stats } = useQuery(trpcCredentials.users.getProfileStats.queryOptions());

  const isPro = userResponse?.user.stripePlanActive ?? false;

  const algorithmLimit = isPro ? PRO_PLAN_MAX_ALGORITHMS_COUNT : BASIC_PLAN_MAX_ALGORITHMS_COUNT;
  const algorithmCount = stats?.numberOfAlgorithms ?? 0;
  const isAtAlgorithmLimit = algorithmCount >= algorithmLimit;

  const concurrentLimit = isPro
    ? PRO_PLAN_MAX_CONCURRENT_BACKTESTS
    : BASIC_PLAN_MAX_CONCURRENT_BACKTESTS;
  const concurrentCount = stats?.concurrentBacktests ?? 0;
  const isAtConcurrentLimit = concurrentCount >= concurrentLimit;

  const monthlyLimit = isPro
    ? PRO_PLAN_MAX_BACKTESTS_PER_MONTH
    : BASIC_PLAN_MAX_BACKTESTS_PER_MONTH;
  const monthlyCount = stats?.backtestsThisMonth ?? 0;
  const isAtMonthlyLimit = monthlyCount >= monthlyLimit;

  return {
    algorithmCount,
    algorithmLimit,
    concurrentCount,
    concurrentLimit,
    isAtAlgorithmLimit,
    isAtConcurrentLimit,
    isAtMonthlyLimit,
    isPro,
    monthlyCount,
    monthlyLimit,
  };
}
