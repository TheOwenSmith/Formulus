import { trpcCredentials } from '@client/lib/trpc';
import { useBacktestStore } from '@client/store/backtestStore';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const COOLDOWN_MS = 10_000;

// Module-level: persists across component remounts and page navigation
let globalLastSubmittedAt: number | null = null;

function getCooldownSecondsLeft(): number {
  if (globalLastSubmittedAt == null) return 0;
  return Math.max(0, Math.ceil((globalLastSubmittedAt + COOLDOWN_MS - Date.now()) / 1000));
}

export function useRunBacktest() {
  const { pendingAlgorithmIds, setPending } = useBacktestStore();
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState(getCooldownSecondsLeft);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Resume countdown if there's an active cooldown from a previous page/instance
    if (getCooldownSecondsLeft() > 0) {
      cooldownIntervalRef.current = setInterval(() => {
        setCooldownSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(cooldownIntervalRef.current!);
            cooldownIntervalRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (cooldownIntervalRef.current != null) clearInterval(cooldownIntervalRef.current);
    };
  }, []);

  function startCooldown() {
    globalLastSubmittedAt = Date.now();
    if (cooldownIntervalRef.current != null) clearInterval(cooldownIntervalRef.current);
    setCooldownSecondsLeft(10);
    cooldownIntervalRef.current = setInterval(() => {
      setCooldownSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownIntervalRef.current!);
          cooldownIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  const { mutateAsync: backtestAlgorithms } = useMutation(
    trpcCredentials.backtesting.backtestAlgorithms.mutationOptions(),
  );

  async function runBacktest(
    algorithmIds: string | string[],
    timespan?: [string | null, string | null],
    name?: string,
  ) {
    const ids = Array.isArray(algorithmIds) ? algorithmIds : [algorithmIds];
    try {
      const { publicId } = await backtestAlgorithms({
        algorithms: ids.map((id) => ({ id })),
        timespan,
        name,
      });
      setPending(ids, publicId);
      startCooldown();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start backtest');
    }
  }

  const pendingAlgorithmIdsSet = new Set(pendingAlgorithmIds);
  return { isPendingIds: pendingAlgorithmIdsSet, cooldownSecondsLeft, runBacktest };
}
