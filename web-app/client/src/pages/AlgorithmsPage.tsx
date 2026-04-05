import { RunBacktestModal } from '@client/components/RunBacktestModal';
import { Tooltip } from '@client/components/Tooltip';
import { useRunBacktest } from '@client/hooks/useRunBacktest';
import { AlgorithmType } from '@shared/api';
import { trpcCredentials } from '@client/lib/trpc';
import type { AnyUserAlgorithmType } from '@shared/worker';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLoaderData, useNavigate, useRevalidator } from 'react-router-dom';
import { toast } from 'sonner';

type AlgorithmWithId = AnyUserAlgorithmType & { id: string; updatedAt?: string };

const TYPE_LABEL: Record<number, string> = {
  [AlgorithmType.NORMAL]: 'Normal',
  [AlgorithmType.SIMPLE]: 'Simple',
  [AlgorithmType.TOP_K]: 'Top-K',
};

const TYPE_COLOR: Record<number, string> = {
  [AlgorithmType.NORMAL]: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-300',
  [AlgorithmType.SIMPLE]: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-300',
  [AlgorithmType.TOP_K]: 'from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-300',
};

const LANG_LABEL: Record<string, string> = {
  cpp: 'C++',
  javascript: 'JavaScript',
  python: 'Python',
  typescript: 'TypeScript',
};

function getTickers(algorithm: AnyUserAlgorithmType): string[] {
  if (algorithm.type === AlgorithmType.SIMPLE) {
    return [(algorithm as { ticker: string }).ticker];
  }
  return (algorithm as { tickers: string[] }).tickers;
}

function formatLastEdited(updatedAt: string | undefined): string {
  if (!updatedAt) return '';
  try {
    const d = new Date(updatedAt);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return '';
  }
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-3.5 w-3.5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function AlgorithmCard({
  algorithm,
  onRunBacktest,
  onRequestDelete,
  isRunning,
  cooldownSecondsLeft,
  isDeleting,
  onClick,
}: {
  algorithm: AlgorithmWithId;
  onRunBacktest: () => void;
  onRequestDelete: (algorithm: AlgorithmWithId) => void;
  isRunning: boolean;
  cooldownSecondsLeft: number;
  isDeleting: boolean;
  onClick: () => void;
}) {
  const tickers = getTickers(algorithm);
  const typeColorClass = TYPE_COLOR[algorithm.type] ?? TYPE_COLOR[AlgorithmType.NORMAL];
  const lastEdited = formatLastEdited(algorithm.updatedAt);
  const tooltipContent = (
    <div className="flex flex-col gap-0.5 text-xs">
      {tickers.length > 0 && (
        <div>
          <span className="text-white/50">Tickers: </span>
          <span className="font-mono">{tickers.join(', ')}</span>
        </div>
      )}
      {lastEdited && (
        <div>
          <span className="text-white/50">Last edited: </span>
          <span>{lastEdited}</span>
        </div>
      )}
      <div className="text-white/50">
        Context {algorithm.contextLength} bars · {algorithm.aggregate}
      </div>
    </div>
  );

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation();
    onRequestDelete(algorithm);
  }

  return (
    <Tooltip content={tooltipContent} className="w-full">
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className="relative bg-slate-900/60 rounded-2xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] flex flex-col gap-3.5 cursor-pointer hover:shadow-[0_20px_60px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.1)] hover:-translate-y-0.5 transition-all duration-300 group"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold text-white group-hover:text-blue-200 transition-colors duration-200 truncate min-w-0">
          {algorithm.name}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleDeleteClick}
            disabled={isDeleting}
            title="Delete algorithm"
            className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <Spinner />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-lg bg-gradient-to-r border ${typeColorClass}`}
          >
            {TYPE_LABEL[algorithm.type]}
          </span>
        </div>
      </div>

      {/* Meta pills */}
      <div className="flex flex-wrap gap-1.5 text-xs text-white/50">
        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 font-medium">
          {LANG_LABEL[algorithm.language] ?? algorithm.language}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
          {algorithm.aggregate}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
          ctx length {algorithm.contextLength}
        </span>
      </div>

      {/* Tickers */}
      <div className="flex flex-wrap gap-1">
        {tickers.slice(0, 6).map((ticker) => (
          <span
            key={ticker}
            className="text-xs px-1.5 py-0.5 rounded font-mono bg-slate-700/60 border border-white/10 text-white/60"
          >
            {ticker}
          </span>
        ))}
        {tickers.length > 6 && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/40">
            +{tickers.length - 6}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        {/* Open editor */}
        <button
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200 cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          Editor
        </button>

        {/* Run backtest */}
        <button
          onClick={(e) => { e.stopPropagation(); onRunBacktest(); }}
          disabled={isRunning || cooldownSecondsLeft > 0}
          title={cooldownSecondsLeft > 0 && !isRunning ? `Please wait ${cooldownSecondsLeft}s before submitting another backtest` : undefined}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-200 cursor-pointer ${
            isRunning || cooldownSecondsLeft > 0
              ? 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-500/15 to-teal-500/15 hover:from-emerald-500/25 hover:to-teal-500/25 border-emerald-500/25 hover:border-emerald-500/40 text-emerald-300'
          }`}
        >
          {isRunning ? (
            <>
              <Spinner />
              Running…
            </>
          ) : cooldownSecondsLeft > 0 ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Wait {cooldownSecondsLeft}s
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run
            </>
          )}
        </button>
      </div>
    </div>
    </Tooltip>
  );
}

const HEADER_OFFSET = '4rem';

export function AlgorithmsPage() {
  const { algorithms } = useLoaderData() as { algorithms: AlgorithmWithId[] };
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const queryClient = useQueryClient();
  const { isPendingId, cooldownSecondsLeft, runBacktest } = useRunBacktest();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [runModalAlgorithm, setRunModalAlgorithm] = useState<AlgorithmWithId | null>(null);

  const { mutateAsync: deleteAlgorithm } = useMutation(
    trpcCredentials.algorithms.deleteAlgorithm.mutationOptions({
      onError: (error) => {
        setDeletingId(null);
        toast.error(error instanceof Error ? error.message : 'Failed to delete algorithm');
      },
    }),
  );

  async function handleDelete(id: string) {
    setConfirmDelete(null);
    setDeletingId(id);
    try {
      await deleteAlgorithm({ id });
      await queryClient.refetchQueries({ queryKey: trpcCredentials.algorithms.getAlgorithms.queryKey() });
      revalidator.revalidate();
      toast.success('Algorithm deleted');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
    <div
      className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 font-sans text-white overflow-hidden flex flex-col"
      style={{ position: 'fixed', top: HEADER_OFFSET, left: 0, right: 0, bottom: 0 }}
    >
      <div className="max-w-[1400px] w-full mx-auto px-8 pt-6 pb-12 flex-1 min-h-0 overflow-auto animate-[fadeInUp_0.8s_ease-out]">
        <div className="flex items-center justify-between gap-6 mb-8">
          <div className="min-w-0 flex-1">
            <h1
              className="text-3xl font-bold bg-clip-text text-transparent w-full pb-1"
              style={{ backgroundImage: 'linear-gradient(to right, #22d3ee, #3b82f6, #a855f7)' }}
            >
              My Algorithms
            </h1>
            {algorithms.length > 0 && (
              <p className="text-white/40 text-sm mt-1">{algorithms.length} algorithm{algorithms.length !== 1 ? 's' : ''}</p>
            )}
          </div>
          <button
            onClick={() => navigate('/algorithms/new')}
            className="shrink-0 px-5 py-2.5 rounded-xl font-medium text-sm cursor-pointer transition-all duration-300 flex items-center gap-2 border hover:-translate-y-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 border-blue-500/30 hover:border-blue-500/50 text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Algorithm
          </button>
        </div>

        {algorithms.length === 0 ? (
          <div className="bg-slate-900/60 rounded-2xl p-20 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] flex flex-col items-center gap-4 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/15 to-purple-500/15 border border-blue-500/25 flex items-center justify-center mb-2">
              <svg className="w-10 h-10 text-blue-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">No algorithms yet</h2>
            <p className="text-white/40 max-w-sm text-sm leading-relaxed">
              Build your first trading strategy to start backtesting against historical market data.
            </p>
            <button
              onClick={() => navigate('/algorithms/new')}
              className="mt-3 px-6 py-3 rounded-xl font-medium text-sm cursor-pointer transition-all duration-300 border hover:-translate-y-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 border-blue-500/30 hover:border-blue-500/50 text-white"
            >
              Create your first algorithm
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {algorithms.map((algorithm) => (
              <AlgorithmCard
                key={algorithm.id}
                algorithm={algorithm}
                onRunBacktest={() => setRunModalAlgorithm(algorithm)}
                onRequestDelete={(algo) => setConfirmDelete({ id: algo.id, name: algo.name })}
                isRunning={isPendingId === algorithm.id}
                cooldownSecondsLeft={cooldownSecondsLeft}
                isDeleting={deletingId === algorithm.id}
                onClick={() => navigate(`/algorithms/${algorithm.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Run backtest modal */}
    {runModalAlgorithm && (
      <RunBacktestModal
        algorithmName={runModalAlgorithm.name}
        onConfirm={(timespan, name) => {
          void runBacktest(runModalAlgorithm.id, timespan, name);
          setRunModalAlgorithm(null);
        }}
        onClose={() => setRunModalAlgorithm(null)}
      />
    )}

    {/* Delete confirmation modal */}
    {confirmDelete && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        onClick={() => setConfirmDelete(null)}
      >
        <div
          className="w-full max-w-md rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.08)] bg-slate-900/95 backdrop-blur-[10px] border border-white/10 p-6 animate-[fadeInUp_0.2s_ease-out]"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="confirm-delete-title" className="text-lg font-semibold text-white mb-1">
            Delete algorithm?
          </h2>
          <p className="text-white/60 text-sm mb-6">
            <span className="font-medium text-white/80">&quot;{confirmDelete.name}&quot;</span> will be permanently deleted. This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-white/20 bg-white/5 text-white/80 hover:bg-white/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleDelete(confirmDelete.id)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-red-500/40 bg-red-500/20 text-red-300 hover:bg-red-500/30 hover:border-red-500/50 transition-colors cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
