import { trpcCredentials, trpcCredentialsClient } from '@client/lib/trpc';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const COOLDOWN_MS = 10_000;

// Module-level: persists across component remounts and page navigation
let globalLastSubmittedAt: number | null = null;

function getCooldownSecondsLeft(): number {
  if (globalLastSubmittedAt == null) return 0;
  return Math.max(0, Math.ceil((globalLastSubmittedAt + COOLDOWN_MS - Date.now()) / 1000));
}

export function useRunBacktest() {
  const navigate = useNavigate();
  const [isPendingId, setIsPendingId] = useState<string | null>(null);
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState(getCooldownSecondsLeft);
  const cancelledRef = useRef(false);
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
      cancelledRef.current = true;
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

  function schedulePoll(publicId: string) {
    if (cancelledRef.current) return;

    setTimeout(async () => {
      if (cancelledRef.current) return;
      try {
        const status = await trpcCredentialsClient.backtesting.getSubmissionStatus.query({
          publicId,
        });
        if (cancelledRef.current) return;

        if (status.status === 'FINISHED') {
          setIsPendingId(null);
          navigate(`/backtest/${publicId}`);
        } else if (status.status === 'ERROR') {
          setIsPendingId(null);
          toast.error(status.error ?? 'Backtest failed');
        } else {
          schedulePoll(publicId);
        }
      } catch (e) {
        if (cancelledRef.current) return;
        setIsPendingId(null);
        toast.error(e instanceof Error ? e.message : 'Failed to get backtest status');
      }
    }, 2000);
  }

  async function runBacktest(algorithmId: string, timespan?: [string | null, string | null]) {
    cancelledRef.current = false;
    setIsPendingId(algorithmId);
    try {
      const { publicId } = await backtestAlgorithms({ algorithms: [{ id: algorithmId }], timespan });
      startCooldown();
      schedulePoll(publicId);
    } catch (e) {
      setIsPendingId(null);
      toast.error(e instanceof Error ? e.message : 'Failed to start backtest');
    }
  }

  return { isPendingId, cooldownSecondsLeft, runBacktest };
}
