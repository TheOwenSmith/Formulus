import { trpcCredentials } from '@client/lib/trpc';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

type Timespan = [string | null, string | null];

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function subtractYears(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().split('T')[0];
}

function DateField({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: string;
  max: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex-1">
      <label className="block text-xs text-white/40 uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative group">
        {/* Calendar icon */}
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <svg
            className="w-3.5 h-3.5 text-white/25 group-focus-within:text-emerald-400/60 transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <input
          type="date"
          value={value}
          max={max}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl bg-white/[0.06] border border-white/10 pl-8 pr-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 focus:bg-white/[0.08] transition-all [color-scheme:dark] cursor-pointer"
        />
      </div>
    </div>
  );
}

const PRESETS = [
  { label: '1Y', years: 1 },
  { label: '2Y', years: 2 },
  { label: '5Y', years: 5 },
  { label: '10Y', years: 10 },
  { label: 'All Time', years: null as null },
];

export function RunBacktestModal({
  algorithms,
  onConfirm,
  onClose,
}: {
  algorithms: { id: string; name: string }[];
  onConfirm: (algorithmIds: string[], timespan?: Timespan, name?: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(() =>
    algorithms.length === 1 ? `${algorithms[0].name} (${new Date().toISOString().split('T')[0]})` : '',
  );
  const [nameGenerating, setNameGenerating] = useState(false);
  const [startDate, setStartDate] = useState(() => subtractYears(2));
  const [endDate, setEndDate] = useState(() => today());
  const [activePreset, setActivePreset] = useState<string>('2Y');

  const todayStr = today();

  const { mutateAsync: generateBacktestName } = useMutation(
    trpcCredentials.backtesting.generateBacktestName.mutationOptions(),
  );

  // Generate LLM name on mount (multiple algorithms only)
  useEffect(() => {
    if (algorithms.length <= 1) return;
    const algorithmNames = algorithms.map((a) => a.name);
    setNameGenerating(true);
    generateBacktestName({ algorithmNames })
      .then(({ name: generated }) => {
        setName(generated);
      })
      .catch(() => {
        const base =
          algorithmNames.slice(0, 2).join(' vs ') +
          (algorithmNames.length > 2 ? ` +${algorithmNames.length - 2}` : '');
        const fallback = `${base} (${new Date().toISOString().split('T')[0]})`;
        setName(fallback.length <= 64 ? fallback : fallback.slice(0, 64));
      })
      .finally(() => {
        setNameGenerating(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPreset(preset: (typeof PRESETS)[number]) {
    if (preset.years === null) {
      setStartDate('');
      setEndDate('');
    } else {
      setStartDate(subtractYears(preset.years));
      setEndDate(todayStr);
    }
    setActivePreset(preset.label);
  }

  function handleDateChange(type: 'start' | 'end', value: string) {
    if (type === 'start') setStartDate(value);
    else setEndDate(value);
    setActivePreset('');
  }

  function handleRun() {
    const hasStart = startDate !== '';
    const hasEnd = endDate !== '';
    const timespan: Timespan | undefined =
      hasStart || hasEnd ? [hasStart ? startDate : null, hasEnd ? endDate : null] : undefined;
    onConfirm(
      algorithms.map((a) => a.id),
      timespan,
      name.trim() || undefined,
    );
  }

  const isSingleAlgorithm = algorithms.length === 1;
  const headerSubtitle = isSingleAlgorithm
    ? algorithms[0].name
    : `${algorithms.length} algorithms`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="run-backtest-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.08)] bg-slate-900/95 backdrop-blur-[10px] border border-white/10 p-6 animate-[fadeInUp_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <svg
              className="w-4 h-4 text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="run-backtest-title"
              className="text-base font-semibold text-white leading-tight"
            >
              Configure Backtest
            </h2>
            <p className="text-xs text-white/40 mt-0.5 truncate">{headerSubtitle}</p>
          </div>
        </div>

        {/* Algorithm list (when multiple) */}
        {!isSingleAlgorithm && (
          <div className="mb-5">
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1.5">
              Algorithms
            </label>
            <div className="flex flex-wrap gap-1.5">
              {algorithms.map((algo) => (
                <span
                  key={algo.id}
                  className="text-xs px-2 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-white/70 font-medium"
                >
                  {algo.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Run name */}
        <div className="mb-5">
          <label className="block text-xs text-white/40 uppercase tracking-wider mb-1.5">
            Run Name{' '}
            <span className="text-white/20 normal-case tracking-normal">(optional)</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={name}
              maxLength={64}
              placeholder={nameGenerating ? 'Generating name…' : 'Enter a name for this run'}
              disabled={nameGenerating}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl bg-white/[0.06] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 focus:bg-white/[0.08] transition-all disabled:opacity-60"
            />
            {nameGenerating && (
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <svg
                  className="animate-spin w-3.5 h-3.5 text-white/30"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Historical window label */}
        <div className="flex items-center gap-2 mb-3">
          <svg
            className="w-3.5 h-3.5 text-white/30"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">
            Historical Window
          </span>
        </div>

        {/* Preset chips */}
        <div className="flex gap-2 mb-5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all duration-150 cursor-pointer ${
                activePreset === p.label
                  ? 'bg-gradient-to-r from-emerald-500/25 to-teal-500/25 border-emerald-500/50 text-emerald-300'
                  : 'bg-white/[0.04] border-white/10 text-white/50 hover:bg-white/[0.08] hover:text-white/70'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/[0.07]" />
          <span className="text-xs text-white/25">or custom range</span>
          <div className="flex-1 h-px bg-white/[0.07]" />
        </div>

        {/* Date inputs */}
        <div className="flex items-end gap-3 mb-6">
          <DateField
            label="From"
            value={startDate}
            max={todayStr}
            onChange={(v) => handleDateChange('start', v)}
          />
          <div className="pb-2.5 text-white/20 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </div>
          <DateField
            label="To"
            value={endDate}
            max={todayStr}
            onChange={(v) => handleDateChange('end', v)}
          />
        </div>

        {/* Active range summary */}
        <div className="mb-5 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-2">
          <svg
            className="w-3.5 h-3.5 text-white/25 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-xs text-white/40 leading-relaxed">
            {startDate || endDate ? (
              <>
                Backtesting from{' '}
                <span className="text-white/70 font-medium">
                  {startDate || 'earliest available'}
                </span>{' '}
                to{' '}
                <span className="text-white/70 font-medium">{endDate || 'latest available'}</span>
              </>
            ) : (
              'Using full available market history'
            )}
          </span>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium border border-white/20 bg-white/5 text-white/80 hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRun}
            className="px-5 py-2.5 rounded-xl text-sm font-medium border border-emerald-500/40 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 hover:border-emerald-500/50 text-white transition-all hover:-translate-y-0.5 cursor-pointer flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Run Backtest
          </button>
        </div>
      </div>
    </div>
  );
}
