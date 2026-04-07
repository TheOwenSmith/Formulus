import { trpcCredentials } from '@client/lib/trpc';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

function TrashIcon({ className }: { className?: string } = {}) {
  return (
    <svg
      className={className ?? 'w-3.5 h-3.5'}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SubmissionStatus = 'PENDING' | 'RUNNING' | 'FINISHED' | 'ERROR' | 'CANCELLED';

type Submission = {
  publicId: string;
  name: string | null;
  status: SubmissionStatus;
  progressPct: number;
  message: string | null;
  error: string | null;
  errorCode: string | null;
  errorDetail: string | null;
  createdAt: string;
  startTimespan: string | null;
  endTimespan: string | null;
  algorithmIds: string[];
  algorithmNames: string[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const isActive = (s: SubmissionStatus) => s === 'PENDING' || s === 'RUNNING';

function getSubState(
  status: SubmissionStatus,
  message: string | null,
): 'queued' | 'preparing' | 'running' | 'finishing' | 'finished' | 'error' | 'cancelled' {
  if (status === 'PENDING') return 'queued';
  if (status === 'FINISHED') return 'finished';
  if (status === 'ERROR') return 'error';
  if (status === 'CANCELLED') return 'cancelled';
  if (message === 'Finishing...') return 'finishing';
  if (message === 'Running...') return 'running';
  return 'preparing';
}

// ─── ETA helpers ──────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function RunningETA({ createdAt, pct }: { createdAt: string; pct: number }) {
  // Ticks every second — drives "Running for X" display and ETA countdown
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Record the wall-clock time when pct first becomes > 0. The worker emits pct=0 the moment
  // preparation (Docker startup, compilation) is done and actual backtesting begins. Using this
  // timestamp — rather than createdAt — means preparation time is excluded from ETA estimates.
  const backtestStartRef = useRef<number | null>(null);
  if (pct > 0 && backtestStartRef.current == null) {
    backtestStartRef.current = Date.now();
  }

  // snapshotAt: wall-clock time when this ETA estimate was calculated
  // etaAtSnapshot: the estimated ms remaining at that moment
  // Both are set together on each pct update; the per-second tick then counts down from there.
  const [etaSnapshot, setEtaSnapshot] = useState<{ snapshotAt: number; etaAtSnapshot: number } | null>(null);
  useEffect(() => {
    if (pct < 5 || backtestStartRef.current == null) {
      setEtaSnapshot(null);
      return;
    }
    const elapsed = Date.now() - backtestStartRef.current;
    const remaining = (elapsed * (100 - pct)) / pct;
    if (remaining > 0) {
      setEtaSnapshot({ snapshotAt: Date.now(), etaAtSnapshot: remaining });
    } else {
      setEtaSnapshot(null);
    }
  }, [pct]);

  // Count down from the snapshot by 1s per second; floor at 1s so it never reads "0s left"
  const etaMs = etaSnapshot != null
    ? Math.max(1000, etaSnapshot.etaAtSnapshot - (now - etaSnapshot.snapshotAt))
    : null;

  const elapsed = now - new Date(createdAt).getTime();

  return (
    <div className="flex items-center gap-1.5 text-xs text-white/35">
      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>
        Running for <span className="text-white/55 font-medium">{formatDuration(elapsed)}</span>
      </span>
      {etaMs != null && (
        <>
          <span className="text-white/20">·</span>
          <span>
            ~<span className="text-white/55 font-medium">{formatDuration(etaMs)}</span> left
          </span>
        </>
      )}
    </div>
  );
}

// ─── Shared icon ──────────────────────────────────────────────────────────────

function SpinIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({
  status,
  message,
  pct,
}: {
  status: SubmissionStatus;
  message: string | null;
  pct: number;
}) {
  const sub = getSubState(status, message);
  const configs = {
    cancelled: { label: 'Cancelled', cls: 'bg-white/5 border-white/10 text-white/35', spin: false },
    error: {
      label: 'Error',
      cls: 'from-red-500/15 to-orange-500/15 border-red-500/30 text-red-300',
      spin: false,
    },
    finished: {
      label: 'Complete',
      cls: 'from-emerald-500/15 to-teal-500/15 border-emerald-500/30 text-emerald-300',
      spin: false,
    },
    finishing: {
      label: 'Finishing',
      cls: 'from-violet-500/15 to-purple-500/15 border-violet-500/30 text-violet-300',
      spin: true,
    },
    preparing: {
      label: 'Preparing',
      cls: 'from-amber-500/15 to-yellow-500/15 border-amber-500/30 text-amber-300',
      spin: true,
    },
    queued: { label: 'Queued', cls: 'bg-white/8 border-white/15 text-white/50', spin: true },
    running: {
      label: `Running · ${Math.round(pct)}%`,
      cls: 'from-blue-500/15 to-cyan-500/15 border-blue-500/30 text-blue-300',
      spin: true,
    },
  } as const;
  const { label, cls, spin } = configs[sub];
  const gradientCls = sub === 'queued' || sub === 'cancelled' ? cls : `bg-gradient-to-r ${cls}`;

  return (
    <span
      className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border shrink-0 ${gradientCls}`}
    >
      {spin && <SpinIcon />}
      {sub === 'finished' && (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      )}
      {sub === 'error' && (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
        </svg>
      )}
      {label}
    </span>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({
  pct,
  status,
  message,
}: {
  pct: number;
  status: SubmissionStatus;
  message: string | null;
}) {
  const sub = getSubState(status, message);
  if (sub === 'queued' || sub === 'finished' || sub === 'error' || sub === 'cancelled') return null;

  const isPreparing = sub === 'preparing';
  const fill = isPreparing ? 100 : sub === 'finishing' ? 100 : Math.min(98, pct);
  const color = isPreparing
    ? ''
    : sub === 'finishing'
      ? 'bg-gradient-to-r from-violet-500 to-purple-400'
      : 'bg-gradient-to-r from-blue-500 to-cyan-400';

  return (
    <div className="w-full h-2 rounded-full bg-white/6 overflow-hidden">
      {isPreparing ? (
        <div
          className="h-full w-full rounded-full"
          style={{
            background:
              'linear-gradient(90deg, rgba(251,191,36,0.08) 0%, rgba(251,191,36,0.22) 30%, rgba(253,224,71,0.72) 50%, rgba(251,191,36,0.22) 70%, rgba(251,191,36,0.08) 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmerSweep 1.6s ease-in-out infinite',
          }}
        />
      ) : (
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${fill}%` }}
        />
      )}
    </div>
  );
}

// ─── Terminal modal ───────────────────────────────────────────────────────────

function TerminalModal({ submission, onClose }: { submission: Submission; onClose: () => void }) {
  const { algorithmNames, error, errorDetail } = submission;
  const title = error ?? 'Error';

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.08)] animate-[fadeInUp_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 bg-[#1e1e1e] border-b border-white/8">
          <div className="flex-1 min-w-0 text-left">
            <span className="text-xs text-white/40 font-mono truncate block">
              {algorithmNames.slice(0, 2).join(', ')}
              {algorithmNames.length > 2 ? ` +${algorithmNames.length - 2}` : ''} — {title}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/30 hover:text-white/70 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Terminal body */}
        <div className="bg-[#0d1117] min-h-[280px] max-h-[60vh] overflow-y-auto p-5 font-mono text-sm leading-relaxed">
          {/* Prompt line */}
          <div className="flex items-center gap-2 mb-4 text-white/30 text-xs">
            <span className="text-emerald-400">❯</span>
            <span>backtesting</span>
            <span className="text-red-400 font-semibold ml-2">✖ {title}</span>
          </div>

          {errorDetail ? (
            <pre className="whitespace-pre-wrap break-words text-red-300/85 text-xs leading-relaxed">
              {errorDetail}
            </pre>
          ) : (
            <span className="text-white/30 text-xs">No error details available.</span>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#161b22] border-t border-white/6 flex items-center justify-between">
          <span className="text-xs text-white/25 font-mono">esc to close</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Submission card ──────────────────────────────────────────────────────────

function SubmissionCard({
  submission,
  onNavigateResults,
  onOpenTerminal,
  onCancel,
  onRequestDelete,
  onClearError,
}: {
  submission: Submission;
  onNavigateResults: () => void;
  onOpenTerminal: () => void;
  onCancel: () => void;
  onRequestDelete: () => void;
  onClearError: () => void;
}) {
  const { algorithmNames, createdAt, error, errorCode, message, name, progressPct, status } =
    submission;
  const sub = getSubState(status, message);
  const canView = sub === 'finished';
  const isUserErr = status === 'ERROR' && errorCode === 'USER_CODE';
  const isCancellable = isActive(status);
  const isClearable = status === 'ERROR' || status === 'CANCELLED';
  const isInteractive = canView || isUserErr;

  function handleClick() {
    if (canView) onNavigateResults();
    else if (isUserErr) onOpenTerminal();
  }

  return (
    <div
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? handleClick : undefined}
      onKeyDown={isInteractive ? (e) => e.key === 'Enter' && handleClick() : undefined}
      className={`bg-slate-900/60 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] overflow-hidden transition-all duration-300 ${
        isInteractive
          ? 'cursor-pointer hover:shadow-[0_24px_70px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.1)] hover:-translate-y-0.5 group'
          : ''
      }`}
    >
      {/* Top accent line for active submissions */}
      {isActive(status) && (
        <div
          className={`h-0.5 w-full ${sub === 'preparing' ? 'bg-amber-400/50' : sub === 'finishing' ? 'bg-violet-500/60' : 'bg-gradient-to-r from-blue-500 to-cyan-400'}`}
        />
      )}

      <div className="p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2 min-w-0 flex-1">
            {/* Primary title: explicit name or derived from algorithm names + date */}
            <p className="text-base font-semibold text-white/90 truncate leading-snug">
              {name ??
                (() => {
                  const base = algorithmNames.slice(0, 2).join(', ');
                  const suffix = algorithmNames.length > 2 ? ` +${algorithmNames.length - 2}` : '';
                  const date = new Date(createdAt).toISOString().split('T')[0];
                  return `${base}${suffix} (${date})`;
                })()}
            </p>
            {/* Algorithm chips — always shown as secondary context */}
            <div className="flex flex-wrap gap-1.5">
              {algorithmNames.slice(0, 6).map((algName) => (
                <span
                  key={algName}
                  className="text-xs px-2 py-0.5 rounded-md bg-white/5 border border-white/8 text-white/45 truncate max-w-[180px]"
                >
                  {algName}
                </span>
              ))}
              {algorithmNames.length > 6 && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-white/5 border border-white/8 text-white/30">
                  +{algorithmNames.length - 6}
                </span>
              )}
            </div>
          </div>
          <StatusBadge status={status} message={message} pct={progressPct} />
        </div>

        {/* Progress bar (active only) */}
        {isActive(status) && <ProgressBar pct={progressPct} status={status} message={message} />}

        {/* ETA row (running only) */}
        {status === 'RUNNING' && <RunningETA createdAt={createdAt} pct={progressPct} />}

        {/* Error summary (non-user-code system errors) */}
        {status === 'ERROR' && !isUserErr && (
          <p className="text-sm text-red-400/70">An internal error occurred. Please try again.</p>
        )}

        {/* User code error preview + CTA */}
        {isUserErr && (
          <div className="rounded-xl bg-black/25 border border-red-500/20 px-4 py-3 flex items-start gap-3">
            <svg
              className="w-4 h-4 text-red-400/70 mt-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-300 mb-1">{error}</p>
              {submission.errorDetail && (
                <p className="text-xs text-white/35 font-mono truncate">
                  {submission.errorDetail.split('\n')[0]}
                </p>
              )}
            </div>
            <span className="text-xs text-red-400/50 group-hover:text-red-300 transition-colors shrink-0 flex items-center gap-1 mt-0.5">
              View error
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </span>
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between text-xs text-white/35">
          <span>{timeAgo(createdAt)}</span>
          <div className="flex items-center gap-3">
            {isCancellable && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                className="flex items-center gap-1 text-white/30 hover:text-red-400 transition-colors font-medium cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Cancel
              </button>
            )}
            {isClearable && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearError();
                }}
                className="flex items-center gap-1 text-white/25 hover:text-red-400/80 transition-colors font-medium cursor-pointer"
              >
                <TrashIcon />
                Clear
              </button>
            )}
            {canView && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestDelete();
                }}
                className="flex items-center gap-1 text-white/20 hover:text-red-400/70 transition-colors cursor-pointer"
              >
                <TrashIcon />
                Delete
              </button>
            )}
            {canView && (
              <span className="flex items-center gap-1 text-emerald-400/55 group-hover:text-emerald-300 transition-colors font-medium">
                View results
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Algorithm filter dropdown ────────────────────────────────────────────────

function AlgorithmFilterDropdown({
  algorithms,
  value,
  onChange,
}: {
  algorithms: { id: string; name: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, handleClickOutside]);

  const selectedName = value ? (algorithms.find((a) => a.id === value)?.name ?? 'Algorithm') : null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="group flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 transition-all duration-200 hover:border-blue-500/25 hover:bg-blue-500/10 focus:outline-none cursor-pointer"
      >
        <svg
          className="h-3.5 w-3.5 shrink-0 text-white/40 transition-colors duration-200 group-hover:text-blue-400/85"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
          />
        </svg>
        <span
          className={`text-sm font-medium transition-colors duration-200 ${
            selectedName
              ? 'text-white group-hover:text-cyan-100/95'
              : 'text-white/50 group-hover:text-blue-200/90'
          }`}
        >
          {selectedName ?? 'All algorithms'}
        </span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-white/40 transition-all duration-200 group-hover:text-blue-400/85 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1.5 bg-slate-800/95 border border-white/10 rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur-[10px] overflow-hidden z-50 min-w-[180px]">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setIsOpen(false);
            }}
            className={`w-full text-left px-3 py-2 text-xs font-medium transition-all duration-150 ${
              value === null
                ? 'text-white border-l-2 border-l-blue-500 bg-blue-500/15'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            All algorithms
          </button>
          {algorithms.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                onChange(a.id);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs font-medium transition-all duration-150 ${
                value === a.id
                  ? 'text-white border-l-2 border-l-blue-500 bg-blue-500/15'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  const navigate = useNavigate();
  return (
    <div className="bg-slate-900/60 rounded-2xl p-20 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] flex flex-col items-center gap-4 text-center">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/15 border border-emerald-500/25 flex items-center justify-center mb-2">
        <svg
          className="w-10 h-10 text-emerald-400/70"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-white">No backtests yet</h2>
      <p className="text-white/40 max-w-sm text-sm leading-relaxed">
        Run a backtest from one of your algorithms to see results here.
      </p>
      <button
        onClick={() => navigate('/algorithms')}
        className="mt-3 px-6 py-3 rounded-xl font-medium text-sm cursor-pointer transition-all duration-300 border hover:-translate-y-0.5 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border-emerald-500/30 hover:border-emerald-500/50 text-white"
      >
        Go to Algorithms
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const HEADER_OFFSET = '4rem';

export function SubmissionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const algorithmFilter = searchParams.get('algorithm');
  const [terminalSubmission, setTerminalSubmission] = useState<Submission | null>(null);
  const [confirmDeleteSubmission, setConfirmDeleteSubmission] = useState<Submission | null>(null);

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

  const { mutate: deleteBacktestResult } = useMutation(
    trpcCredentials.backtesting.deleteBacktestResult.mutationOptions({
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to delete backtest');
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpcCredentials.backtesting.getSubmissions.queryKey(),
        });
      },
    }),
  );

  const { mutate: clearBacktestError } = useMutation(
    trpcCredentials.backtesting.clearBacktestError.mutationOptions({
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to clear backtest');
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpcCredentials.backtesting.getSubmissions.queryKey(),
        });
      },
    }),
  );

  const { data: submissions = [], isLoading } = useQuery({
    ...trpcCredentials.backtesting.getSubmissions.queryOptions(),
    refetchInterval: (query) => {
      const data = query.state.data as Submission[] | undefined;
      if (!data) return false;
      return data.some((s) => isActive(s.status)) ? 2000 : false;
    },
  });

  const allSubmissions = submissions as Submission[];
  const list = algorithmFilter
    ? allSubmissions.filter((s) => s.algorithmIds.includes(algorithmFilter))
    : allSubmissions;
  const activeCount = list.filter((s) => isActive(s.status)).length;
  const clearableCount = list.filter((s) => s.status === 'ERROR' || s.status === 'CANCELLED').length;

  function handleClearAllErrors() {
    list
      .filter((s) => s.status === 'ERROR' || s.status === 'CANCELLED')
      .forEach((s) => clearBacktestError({ publicId: s.publicId }));
  }

  // Build unique algorithm list from all submissions (preserves first-seen order)
  const uniqueAlgorithms = (() => {
    const seen = new Map<string, string>();
    for (const s of allSubmissions) {
      s.algorithmIds.forEach((id, i) => {
        if (!seen.has(id)) seen.set(id, s.algorithmNames[i] ?? id);
      });
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  })();

  function setFilter(id: string | null) {
    if (id) setSearchParams({ algorithm: id });
    else setSearchParams({});
  }

  return (
    <>
      <div
        className="bg-slate-900 font-sans text-white overflow-hidden flex flex-col"
        style={{ bottom: 0, left: 0, position: 'fixed', right: 0, top: HEADER_OFFSET }}
      >
        <div
          className="w-full mx-auto px-8 pt-8 pb-12 flex-1 min-h-0 overflow-y-auto"
          style={{ maxWidth: '760px' }}
        >
          {/* Page header — title row shares baseline with actions; subtitle below */}
          <div className="mb-8">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <h1
                className="text-3xl font-bold bg-clip-text text-transparent min-w-0 m-0 leading-tight"
                style={{
                  backgroundImage: 'linear-gradient(to right, #34d399, #3b82f6, #a855f7)',
                }}
              >
                My Backtests
              </h1>
              <div className="flex items-center gap-2 shrink-0">
                {clearableCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllErrors}
                    className="group flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/55 transition-all duration-200 hover:border-red-500/25 hover:bg-red-500/10 hover:text-red-200/90 focus:outline-none cursor-pointer"
                  >
                    <TrashIcon className="h-3.5 w-3.5 shrink-0 text-white/40 transition-colors group-hover:text-red-400/85" />
                    Clear errors ({clearableCount})
                  </button>
                )}
                {uniqueAlgorithms.length > 0 && (
                  <AlgorithmFilterDropdown
                    algorithms={uniqueAlgorithms}
                    value={algorithmFilter}
                    onChange={setFilter}
                  />
                )}
              </div>
            </div>
            {allSubmissions.length > 0 && (
              <p className="mt-2 text-sm leading-normal text-white/40">
                {algorithmFilter
                  ? `${list.length} of ${allSubmissions.length}`
                  : `${allSubmissions.length}`}{' '}
                backtest{allSubmissions.length !== 1 ? 's' : ''}
                {activeCount > 0 && (
                  <span className="ml-2 text-blue-400/70">· {activeCount} active</span>
                )}
              </p>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <SpinIcon className="h-8 w-8 text-white/30" />
            </div>
          ) : list.length === 0 && !algorithmFilter ? (
            <EmptyState />
          ) : list.length === 0 ? (
            <div className="bg-slate-900/60 rounded-2xl p-16 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] flex flex-col items-center gap-3 text-center">
              <p className="text-white/40 text-sm">No backtests found for this algorithm.</p>
              <button
                type="button"
                onClick={() => setFilter(null)}
                className="text-sm text-blue-400/70 hover:text-blue-400 transition-colors cursor-pointer"
              >
                Clear filter
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 animate-[fadeInUp_0.5s_ease-out]">
              {list.map((submission) => (
                <SubmissionCard
                  key={submission.publicId}
                  submission={submission}
                  onNavigateResults={() => navigate(`/backtest/${submission.publicId}`)}
                  onOpenTerminal={() => setTerminalSubmission(submission)}
                  onCancel={() => cancelBacktest({ publicId: submission.publicId })}
                  onRequestDelete={() => setConfirmDeleteSubmission(submission)}
                  onClearError={() => clearBacktestError({ publicId: submission.publicId })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Terminal modal */}
      {terminalSubmission && (
        <TerminalModal
          submission={terminalSubmission}
          onClose={() => setTerminalSubmission(null)}
        />
      )}

      {/* Delete confirmation modal */}
      {confirmDeleteSubmission && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmDeleteSubmission(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.08)] bg-slate-900/95 backdrop-blur-[10px] border border-white/10 p-6 animate-[fadeInUp_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-white mb-1">Delete backtest results?</h2>
            <p className="text-white/60 text-sm mb-6">
              Results for{' '}
              <span className="font-medium text-white/80">
                {confirmDeleteSubmission.algorithmNames.slice(0, 2).join(', ')}
                {confirmDeleteSubmission.algorithmNames.length > 2
                  ? ` +${confirmDeleteSubmission.algorithmNames.length - 2} more`
                  : ''}
              </span>{' '}
              will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteSubmission(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border border-white/20 bg-white/5 text-white/80 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteBacktestResult({ publicId: confirmDeleteSubmission.publicId });
                  setConfirmDeleteSubmission(null);
                }}
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
