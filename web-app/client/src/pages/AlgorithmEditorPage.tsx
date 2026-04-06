import { ExamplesModal } from '@client/components/ExamplesModal';
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

// ─── Monaco type declarations for ./utils module ──────────────────────────────

const UTILS_TYPE_DECLARATION = `
declare module './utils' {
  /**
   * A market bar tuple: [timestamp, open, high, low, close, volume]
   *   bar[0] = ISO timestamp string
   *   bar[1] = open price
   *   bar[2] = high price
   *   bar[3] = low price
   *   bar[4] = close price
   *   bar[5] = volume
   */
  export type Bar = [
    timestamp: string,
    open: number,
    high: number,
    low: number,
    close: number,
    volume: number,
  ];

  /** A stock ticker symbol, e.g. 'SPY', 'AAPL' */
  export type Ticker = string;

  /** Trading action returned by your implementation function */
  export enum Action {
    /** Buy the asset (or increase position) */
    BUY = 0,
    /** Sell the asset (or decrease position) */
    SELL = 1,
    /** Hold current position unchanged */
    HOLD = 2,
  }

  /** SuperTrend direction */
  export enum Direction {
    /** Price is above the SuperTrend line (uptrend) */
    UP = 0,
    /** Price is below the SuperTrend line (downtrend) */
    DOWN = 1,
  }

  /**
   * Returns the day of the week name for a bar timestamp.
   * @param timestamp ISO timestamp string from bar[0], e.g. "2024-01-15T10:00:00Z"
   * @returns Day name, e.g. 'Monday', 'Tuesday', ...
   *
   * @example
   * const timestamp = context[0][0];
   * if (dayOfWeek(timestamp) === 'Monday') return Action.SELL;
   */
  export function dayOfWeek(
    timestamp: string,
  ): 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
}

/**
 * Maps indicator strings to their computed result types.
 *
 * SMA(n), EMA(n), RSI(n), ATR(n)  →  (number | null)[]
 *   Access: indicators[ticker]['SMA(20)']!.at(-1)!
 *
 * LinearRegression(n)  →  { slope: number; intercept: number }
 *   Access: const { slope, intercept } = indicators[ticker]['LinearRegression(50)']!;
 *
 * SuperTrend(n,m)  →  ({ superTrendValue: number; direction: number } | null)[]
 *   Access: const { direction } = indicators[ticker]['SuperTrend(10,3)']!.at(-1)!;
 *   Compare direction to Direction.UP (0) or Direction.DOWN (1).
 */
declare interface IndicatorResultByIndicator {
  [key: \`SMA(\${number})\`]: (number | null)[];
  [key: \`EMA(\${number})\`]: (number | null)[];
  [key: \`RSI(\${number})\`]: (number | null)[];
  [key: \`ATR(\${number})\`]: (number | null)[];
  [key: \`LinearRegression(\${number})\`]: { slope: number; intercept: number };
  [key: \`SuperTrend(\${number},\${number})\`]: ({ superTrendValue: number; direction: number } | null)[];
}
`;

// ─── Indicators reference data ────────────────────────────────────────────────

type IndicatorRef = {
  name: string;
  fullName: string;
  description: string;
  returns: string;
  example: string;
  url: string;
};

const INDICATORS_REF: IndicatorRef[] = [
  {
    name: 'SMA(n)',
    fullName: 'Simple Moving Average',
    description: 'Average closing price over the last n bars.',
    returns: '(number | null)[]',
    example: "const sma = indicators[ticker]['SMA(20)']!.at(-1)!;",
    url: 'https://www.investopedia.com/terms/s/sma.asp',
  },
  {
    name: 'EMA(n)',
    fullName: 'Exponential Moving Average',
    description: 'Weighted average giving more weight to recent prices.',
    returns: '(number | null)[]',
    example: "const ema = indicators[ticker]['EMA(12)']!.at(-1)!;",
    url: 'https://www.investopedia.com/terms/e/ema.asp',
  },
  {
    name: 'RSI(n)',
    fullName: 'Relative Strength Index',
    description: 'Momentum oscillator ranging 0-100. Below 30 = oversold, above 70 = overbought.',
    returns: '(number | null)[]',
    example: "const rsi = indicators[ticker]['RSI(14)']!.at(-1)!;\nif (rsi < 30) result[ticker] = Action.BUY;",
    url: 'https://www.investopedia.com/terms/r/rsi.asp',
  },
  {
    name: 'ATR(n)',
    fullName: 'Average True Range',
    description: 'Measures market volatility. Higher value = larger price swings.',
    returns: '(number | null)[]',
    example: "const atr = indicators[ticker]['ATR(14)']!.at(-1)!;",
    url: 'https://www.investopedia.com/terms/a/atr.asp',
  },
  {
    name: 'LinearRegression(n)',
    fullName: 'Linear Regression',
    description: 'Fits a trend line over n bars. Returns slope and intercept.',
    returns: '{ slope: number; intercept: number }',
    example: "const { slope, intercept } = indicators[ticker]['LinearRegression(50)']!;\nconst value = slope * 49 + intercept; // value at last bar",
    url: 'https://www.investopedia.com/terms/r/regression.asp',
  },
  {
    name: 'SuperTrend(n,m)',
    fullName: 'SuperTrend',
    description: 'Trend-following indicator. direction: UP (0) or DOWN (1). Multiply m controls sensitivity.',
    returns: '({ superTrendValue: number; direction: number } | null)[]',
    example: "const { direction } = indicators[ticker]['SuperTrend(10,3)']!.at(-1)!;\nif (direction === Direction.UP) result[ticker] = Action.BUY;",
    url: 'https://www.investopedia.com/supertrend-indicator-7976167',
  },
];

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

function IndicatorReferenceSection() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="p-5 border-t border-white/[0.07]">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-3.5 h-3.5 text-white/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Indicators</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {INDICATORS_REF.map((ind) => {
          const isOpen = expanded === ind.name;
          return (
            <div key={ind.name}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : ind.name)}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-white/[0.05] transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-mono text-violet-300 shrink-0">{ind.name}</span>
                  <span className="text-[10px] text-white/35 truncate">{ind.fullName}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-1">
                  <a
                    href={ind.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title={`${ind.fullName} on Investopedia`}
                    className="text-white/20 hover:text-blue-400 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  <svg
                    className={`w-3 h-3 text-white/25 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {isOpen && (
                <div className="mx-2 mb-1 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-[10px] space-y-2">
                  <p className="text-white/60 leading-relaxed">{ind.description}</p>
                  <div>
                    <span className="text-white/30 uppercase tracking-wider text-[9px]">Returns</span>
                    <p className="font-mono text-violet-300/80 mt-0.5">{ind.returns}</p>
                  </div>
                  <div>
                    <span className="text-white/30 uppercase tracking-wider text-[9px]">Example</span>
                    <pre className="font-mono text-emerald-300/70 mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
                      {ind.example}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LeftPanel({
  algorithm,
  submissions,
  onCancel,
  onOpenExamples,
}: {
  algorithm: AlgorithmWithId;
  submissions: SubmissionSummary[];
  onCancel: (publicId: string) => void;
  onOpenExamples: () => void;
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
      <div className="p-5">
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

      {/* Indicators reference */}
      <IndicatorReferenceSection />

      {/* Examples button */}
      <div className="px-5 pb-4">
        <button
          type="button"
          onClick={onOpenExamples}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/50 hover:text-white/80 transition-all text-xs cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Browse Examples
        </button>
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
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AlgorithmEditorPage() {
  const { algorithm } = useLoaderData() as { algorithm: AlgorithmWithId };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isPendingIds, cooldownSecondsLeft, runBacktest } = useRunBacktest();

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
  const [showExamples, setShowExamples] = useState(false);

  const isRunning = isPendingIds.has(algorithm.id) && cooldownSecondsLeft > 0;
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

  const monacoPath = `algorithm.${getExtension(algorithm.language as SupportedLanguage)}`;

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
            onOpenExamples={() => setShowExamples(true)}
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
              path={monacoPath}
              onChange={(value) => setCode(value ?? '')}
              theme="vs-dark"
              beforeMount={(monaco) => {
                // Inject ./utils type declarations for TypeScript and JavaScript
                monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                  target: monaco.languages.typescript.ScriptTarget.ESNext,
                  module: monaco.languages.typescript.ModuleKind.ESNext,
                  moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
                  strict: false,
                  noUnusedLocals: false,
                  noUnusedParameters: false,
                  allowJs: true,
                });
                monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                  target: monaco.languages.typescript.ScriptTarget.ESNext,
                  module: monaco.languages.typescript.ModuleKind.CommonJS,
                  moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
                  allowJs: true,
                  checkJs: false,
                });
                monaco.languages.typescript.typescriptDefaults.addExtraLib(
                  UTILS_TYPE_DECLARATION,
                  'file:///utils.d.ts',
                );
                monaco.languages.typescript.javascriptDefaults.addExtraLib(
                  UTILS_TYPE_DECLARATION,
                  'file:///utils.d.ts',
                );
              }}
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
        algorithms={[{ id: algorithm.id, name: algorithm.name }]}
        onConfirm={(algorithmIds, timespan, name) => {
          void runBacktest(algorithmIds, timespan, name);
          setShowRunModal(false);
        }}
        onClose={() => setShowRunModal(false)}
      />
    )}

    {showExamples && (
      <ExamplesModal
        algorithmType={algorithm.type as 0 | 1 | 2}
        language={algorithm.language as SupportedLanguage}
        onLoad={(exampleCode) => {
          setCode(exampleCode.trim());
          setShowExamples(false);
          toast.success('Example loaded — remember to save when ready');
        }}
        onClose={() => setShowExamples(false)}
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
