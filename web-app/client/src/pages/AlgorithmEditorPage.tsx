import { RunBacktestModal } from '@client/components/RunBacktestModal';
import { useRunBacktest } from '@client/hooks/useRunBacktest';
import { AlgorithmType } from '@shared/api';
import { trpcCredentials } from '@client/lib/trpc';
import Editor from '@monaco-editor/react';
import type { AnyUserAlgorithmType } from '@shared/worker';
import type { SupportedLanguage } from '@shared/worker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useLoaderData, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlgorithmWithId = AnyUserAlgorithmType & { id: string };

type SubmissionSummary = {
  publicId: string;
  status: string;
  progressPct: number;
  message: string | null;
  error: string | null;
  errorCode: string | null;
  createdAt: Date;
  algorithmIds: string[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<number, string> = {
  [AlgorithmType.NORMAL]: 'Normal',
  [AlgorithmType.SIMPLE]: 'Simple',
  [AlgorithmType.TOP_K]: 'Top-K',
};

const TYPE_COLOR: Record<number, string> = {
  [AlgorithmType.NORMAL]: 'from-blue-500/20 to-cyan-500/20 border-blue-500/40 text-blue-300',
  [AlgorithmType.SIMPLE]: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-300',
  [AlgorithmType.TOP_K]: 'from-purple-500/20 to-pink-500/20 border-purple-500/40 text-purple-300',
};

const LANG_LABEL: Record<string, string> = {
  cpp: 'C++',
  javascript: 'JavaScript',
  python: 'Python',
  typescript: 'TypeScript',
};

const MONACO_LANG: Record<SupportedLanguage, string> = {
  cpp: 'cpp',
  javascript: 'javascript',
  python: 'python',
  typescript: 'typescript',
};

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function submissionStatusLabel(status: string, message: string | null): { label: string; color: string } {
  if (status === 'PENDING') return { label: 'Queued', color: 'text-amber-400' };
  if (status === 'RUNNING') {
    if (message === 'Preparing...') return { label: 'Preparing', color: 'text-amber-400' };
    if (message === 'Finishing...') return { label: 'Finishing', color: 'text-violet-400' };
    return { label: 'Running', color: 'text-blue-400' };
  }
  if (status === 'FINISHED') return { label: 'Finished', color: 'text-emerald-400' };
  if (status === 'ERROR') return { label: 'Error', color: 'text-red-400' };
  if (status === 'CANCELLED') return { label: 'Cancelled', color: 'text-white/40' };
  return { label: status, color: 'text-white/50' };
}

function getTickers(algorithm: AnyUserAlgorithmType): string[] {
  if (algorithm.type === AlgorithmType.SIMPLE) {
    return [(algorithm as { ticker: string }).ticker];
  }
  return (algorithm as { tickers: string[] }).tickers;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 4 }: { size?: number }) {
  return (
    <svg
      className={`animate-spin h-${size} w-${size}`}
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

// ─── Left Panel ───────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/[0.05] last:border-0">
      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-white/50">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-white/40 uppercase tracking-wider mb-0.5">{label}</div>
        <div className="text-sm text-white/90 font-medium">{value}</div>
      </div>
    </div>
  );
}

function LeftPanel({
  algorithm,
  submissions,
  onCancel,
}: {
  algorithm: AlgorithmWithId;
  submissions: SubmissionSummary[];
  onCancel: (publicId: string) => void;
}) {
  const navigate = useNavigate();
  const tickers = getTickers(algorithm);
  const typeColor = TYPE_COLOR[algorithm.type] ?? TYPE_COLOR[AlgorithmType.NORMAL];
  const pastRuns = submissions
    .filter((s) => s.algorithmIds.includes(algorithm.id))
    .slice(0, 5);

  return (
    <div className="flex flex-col h-full overflow-y-auto border-r border-white/[0.07]">
      {/* Name + type */}
      <div className="p-5 border-b border-white/[0.07]">
        <div className="flex items-start gap-2 mb-2">
          <span
            className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg bg-gradient-to-r border ${typeColor}`}
          >
            {TYPE_LABEL[algorithm.type]}
          </span>
        </div>
        <h2 className="text-base font-bold text-white leading-tight">{algorithm.name}</h2>
      </div>

      {/* Info rows */}
      <div className="p-5 flex-1">
        <InfoRow
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          }
          label="Language"
          value={LANG_LABEL[algorithm.language] ?? algorithm.language}
        />
        <InfoRow
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="Timeframe"
          value={algorithm.aggregate}
        />
        <InfoRow
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          label="Context Length"
          value={`${algorithm.contextLength} bars`}
        />
        <InfoRow
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
          label="Max Holding"
          value={`${((algorithm.algorithmMaxHoldingProportion ?? 0.95) * 100).toFixed(0)}%`}
        />
        {algorithm.type === AlgorithmType.TOP_K && (
          <InfoRow
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            }
            label="K (top tickers)"
            value={(algorithm as { k: number }).k}
          />
        )}
        <InfoRow
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          }
          label={algorithm.type === AlgorithmType.SIMPLE ? 'Ticker' : `Tickers (${tickers.length})`}
          value={
            <div className="flex flex-wrap gap-1 mt-0.5">
              {tickers.map((t) => (
                <span
                  key={t}
                  className="text-xs font-mono px-1.5 py-0.5 rounded bg-white/8 border border-white/10 text-white/75"
                >
                  {t}
                </span>
              ))}
            </div>
          }
        />
      </div>

      {/* Past Runs */}
      {pastRuns.length > 0 && (
        <div className="p-5 border-t border-white/[0.07]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Past Runs</span>
            <button
              type="button"
              onClick={() => navigate(`/backtests?algorithm=${algorithm.id}`)}
              className="text-xs text-blue-400/70 hover:text-blue-400 transition-colors cursor-pointer"
            >
              View all
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {pastRuns.map((s) => {
              const { label, color } = submissionStatusLabel(s.status, s.message);
              const isFinished = s.status === 'FINISHED';
              const isCancellable = s.status === 'PENDING' || s.status === 'RUNNING';
              return (
                <div
                  key={s.publicId}
                  className="flex items-center gap-1.5"
                >
                  <button
                    type="button"
                    onClick={() => navigate(isFinished ? `/backtest/${s.publicId}` : `/backtests?algorithm=${algorithm.id}`)}
                    className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors text-left cursor-pointer group"
                  >
                    <span className={`text-xs font-medium ${color}`}>{label}</span>
                    <span className="text-xs text-white/30 group-hover:text-white/50 transition-colors">
                      {timeAgo(s.createdAt)}
                    </span>
                  </button>
                  {isCancellable && (
                    <button
                      type="button"
                      title="Cancel backtest"
                      onClick={() => onCancel(s.publicId)}
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-red-500/20 border border-white/[0.06] hover:border-red-500/40 text-white/30 hover:text-red-400 transition-all cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Docs hint */}
      <div className="p-5 border-t border-white/[0.07]">
        <div className="rounded-xl bg-blue-500/8 border border-blue-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-semibold text-blue-300">Getting started</span>
          </div>
          <p className="text-xs text-white/45 leading-relaxed">
            Your function receives market context and positions. Return{' '}
            {algorithm.type === AlgorithmType.SIMPLE ? 'BUY, SELL, or HOLD' : 'a record of actions by ticker'}{' '}
            on each bar.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AlgorithmEditorPage() {
  const { algorithm } = useLoaderData() as { algorithm: AlgorithmWithId };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isPendingId, cooldownSecondsLeft, runBacktest } = useRunBacktest();

  const [code, setCode] = useState(algorithm.userAlgorithmImplementationCode);
  const [savedCode, setSavedCode] = useState(algorithm.userAlgorithmImplementationCode);
  const isDirty = code !== savedCode;

  const { data: submissions = [] } = useQuery({
    ...trpcCredentials.backtesting.getSubmissions.queryOptions(),
    refetchInterval: (query) => {
      const data = query.state.data as SubmissionSummary[] | undefined;
      if (!data) return false;
      const mine = data.filter((s) => s.algorithmIds.includes(algorithm.id));
      return mine.some((s) => s.status === 'PENDING' || s.status === 'RUNNING') ? 2000 : false;
    },
  });

  const { mutateAsync: saveCode, isPending: isSaving } = useMutation(
    trpcCredentials.algorithms.updateAlgorithmCode.mutationOptions({
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to save code');
      },
      onSuccess: () => {
        setSavedCode(code);
        toast.success('Code saved');
        void queryClient.invalidateQueries({
          queryKey: trpcCredentials.algorithms.getAlgorithm.queryKey({ id: algorithm.id }),
        });
      },
    }),
  );

  const { mutate: cancelBacktest } = useMutation(
    trpcCredentials.backtesting.cancelSubmission.mutationOptions({
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to cancel backtest');
      },
      onSuccess: () => {
        toast.success('Backtest cancelled');
        void queryClient.invalidateQueries({
          queryKey: trpcCredentials.backtesting.getSubmissions.queryKey(),
        });
      },
    }),
  );

  const [showRunModal, setShowRunModal] = useState(false);

  const isRunning = isPendingId === algorithm.id;
  const isBacktestDisabled = isRunning || cooldownSecondsLeft > 0;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty && !isSaving) {
          void saveCode({ code, id: algorithm.id });
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, isSaving, code, algorithm.id, saveCode]);

  return (
    <>
    <div className="flex flex-col bg-slate-950 text-white font-sans overflow-hidden" style={{ height: 'calc(100vh - 79px)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.07] bg-slate-900/70 backdrop-blur-sm shrink-0">
        {/* Left: nav + name */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/algorithms')}
            className="flex items-center gap-1 text-white/40 hover:text-white/70 transition-colors text-sm shrink-0 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Algorithms</span>
          </button>
          <span className="text-white/20">/</span>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-white text-sm truncate">{algorithm.name}</span>
            {isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" title="Unsaved changes" />
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Language pill */}
          <span className="text-xs text-white/40 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg font-mono">
            {LANG_LABEL[algorithm.language] ?? algorithm.language}
          </span>

          {/* Save */}
          <button
            type="button"
            disabled={!isDirty || isSaving}
            onClick={() => saveCode({ code, id: algorithm.id })}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 cursor-pointer ${
              isDirty && !isSaving
                ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-500/40 text-white hover:-translate-y-0.5'
                : 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <>
                <Spinner size={3} />
                Saving…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save
              </>
            )}
          </button>

          {/* Run backtest */}
          <button
            type="button"
            disabled={isBacktestDisabled}
            title={cooldownSecondsLeft > 0 && !isRunning ? `Please wait ${cooldownSecondsLeft}s before submitting another backtest` : undefined}
            onClick={() => setShowRunModal(true)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 cursor-pointer ${
              isBacktestDisabled
                ? 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border-emerald-500/30 hover:border-emerald-500/50 text-white hover:-translate-y-0.5'
            }`}
          >
            {isRunning ? (
              <>
                <Spinner size={3} />
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
                Run Backtest
              </>
            )}
          </button>
        </div>
      </div>

      {/* Body: split layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <div className="w-64 shrink-0 bg-slate-900/50">
          <LeftPanel
            algorithm={algorithm}
            submissions={submissions}
            onCancel={(publicId) => cancelBacktest({ publicId })}
          />
        </div>

        {/* Divider */}
        <div className="w-px bg-white/[0.07] shrink-0" />

        {/* Editor panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Editor header */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.07] bg-slate-900/30 shrink-0">
            <span className="text-xs text-white/30 font-mono">
              {algorithm.name.replaceAll(' ', '_')}.{getExtension(algorithm.language as SupportedLanguage)}
            </span>
          </div>

          {/* Monaco editor */}
          <div className="flex-1">
            <Editor
              height="100%"
              language={MONACO_LANG[algorithm.language as SupportedLanguage] ?? 'javascript'}
              value={code}
              onChange={(value) => setCode(value ?? '')}
              theme="vs-dark"
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                fontLigatures: true,
                lineNumbers: 'on',
                minimap: { enabled: false },
                padding: { top: 16, bottom: 16 },
                renderLineHighlight: 'line',
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                tabSize: 2,
                wordWrap: 'on',
              }}
            />
          </div>
        </div>
      </div>
    </div>

    {showRunModal && (
      <RunBacktestModal
        algorithmName={algorithm.name}
        onConfirm={(timespan) => {
          void runBacktest(algorithm.id, timespan);
          setShowRunModal(false);
        }}
        onClose={() => setShowRunModal(false)}
      />
    )}
    </>
  );
}

function getExtension(language: SupportedLanguage): string {
  const exts: Record<SupportedLanguage, string> = {
    cpp: 'cpp',
    javascript: 'js',
    python: 'py',
    typescript: 'ts',
  };
  return exts[language] ?? 'txt';
}
