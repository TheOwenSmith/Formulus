import { trpcCredentialsClient } from '@client/lib/trpc';
import { useBacktestStore } from '@client/store/backtestStore';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function BacktestPoller() {
  const { pendingPublicId, clearPending } = useBacktestStore();
  const navigate = useNavigate();
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (pendingPublicId == null) return;

    cancelledRef.current = false;

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
            // Compare-and-swap: only the first poll to reach this point fires the toast.
            // StrictMode mounts effects twice, so two polls may be in flight simultaneously.
            if (useBacktestStore.getState().pendingPublicId !== publicId) return;
            clearPending();
            toast.success('Backtest complete!', {
              action: {
                label: 'View Results',
                onClick: () => navigate(`/backtest/${publicId}`),
              },
              actionButtonStyle: { backgroundColor: 'white', color: 'black' },
              duration: 10_000,
            });
          } else if (status.status === 'ERROR') {
            if (useBacktestStore.getState().pendingPublicId !== publicId) return;
            clearPending();
            toast.error(status.error ?? 'Backtest failed');
          } else {
            schedulePoll(publicId);
          }
        } catch (e) {
          if (cancelledRef.current) return;
          clearPending();
          toast.error(e instanceof Error ? e.message : 'Failed to get backtest status');
        }
      }, 2000);
    }

    schedulePoll(pendingPublicId);

    return () => {
      cancelledRef.current = true;
    };
  }, [pendingPublicId]);

  return null;
}
