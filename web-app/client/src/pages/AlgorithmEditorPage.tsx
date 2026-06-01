import { ExamplesModal } from '@client/components/ExamplesModal';
import { RunBacktestModal } from '@client/components/RunBacktestModal';
import { useRunBacktest } from '@client/hooks/useRunBacktest';
import { trpcCredentials } from '@client/lib/trpc';
import Editor from '@monaco-editor/react';
import { ALGORITHM_EXAMPLES, type AlgorithmExample } from '@shared/constants/examples';
import {
  maxPeriodByIndicatorByContextLength,
  minPeriodByIndicator,
  type IndicatorMetadataKey,
} from '@shared/constants/indicator-params';
import type { AnyUserAlgorithmType, SupportedLanguage } from '@shared/constants/trading';
import {
  AlgorithmType,
  MAX_INDICATOR_MULTIPLIER,
  MAX_INDICATORS_COUNT,
} from '@shared/constants/trading';
import { type UserTicker } from '@shared/schemas/trading';
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
  createdAt: string;
  algorithmIds: string[];
};

type IndicatorRef = {
  id: string;
  name: string;
  fullName: string;
  description: string;
  returns: string;
  configExample: string;
  usageByLang?: Record<SupportedLanguage, string>;
  url: string;
  chipColor: string;
  linkedExampleId?: string;
  indicatorKey: IndicatorMetadataKey;
  prefix: string;
  defaultParams: number[];
  paramLabels: string[];
  paramTypes: ('period' | 'multiplier')[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<number, string> = {
  [AlgorithmType.NORMAL]: 'Normal',
  [AlgorithmType.SIMPLE]: 'Simple',
  [AlgorithmType.TOP_K]: 'Top-K',
};

const TYPE_COLOR: Record<number, string> = {
  [AlgorithmType.NORMAL]: 'from-blue-500/20 to-cyan-500/20 border-blue-500/40 text-blue-300',
  [AlgorithmType.SIMPLE]:
    'from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-300',
  [AlgorithmType.TOP_K]: 'from-purple-500/20 to-pink-500/20 border-purple-500/40 text-purple-300',
};

const LANG_LABEL: Record<string, string> = {
  cpp: 'C++',
  javascript: 'JavaScript',
  python: 'Python',
  typescript: 'TypeScript',
};

const LANG_ORDER: SupportedLanguage[] = ['typescript', 'javascript', 'python', 'cpp'];

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

function submissionStatusLabel(
  status: string,
  message: string | null,
): { label: string; color: string } {
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
export declare enum Action {
  /** Buy the asset (or increase position) */
  BUY = 0,
  /** Sell the asset (or decrease position) */
  SELL = 1,
  /** Hold current position unchanged */
  HOLD = 2,
}

/** SuperTrend direction */
export declare enum Direction {
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
export declare function dayOfWeek(
  timestamp: string,
): 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

/**
 * Maps indicator strings to their computed result types.
 *
 * SMA(n), EMA(n), RSI(n), ATR(n)  ->  (number | null)[]
 *   Access: indicators[ticker]['SMA(20)']!.at(-1)!
 *
 * LinearRegression(n)  ->  { slope: number; intercept: number }
 *   Access: const { slope, intercept } = indicators[ticker]['LinearRegression(50)']!;
 *
 * SuperTrend(n,m)  ->  ({ superTrendValue: number; direction: number } | null)[]
 *   Access: const { direction } = indicators[ticker]['SuperTrend(10,3)']!.at(-1)!;
 *   Compare direction to Direction.UP (0) or Direction.DOWN (1).
 */
declare global {
  interface IndicatorResultByIndicator {
    [key: \`SMA(\${number})\`]: (number | null)[];
    [key: \`EMA(\${number})\`]: (number | null)[];
    [key: \`RSI(\${number})\`]: (number | null)[];
    [key: \`ATR(\${number})\`]: (number | null)[];
    [key: \`LinearRegression(\${number})\`]: { slope: number; intercept: number };
    [key: \`SuperTrend(\${number},\${number})\`]: ({ superTrendValue: number; direction: number } | null)[];
  }
}
`;

// ─── Indicators reference data ────────────────────────────────────────────────

const INDICATORS_REF: IndicatorRef[] = [
  {
    chipColor: 'bg-blue-500/15 border-blue-500/30 text-blue-300 hover:bg-blue-500/25',
    configExample: "'SMA(20)'",
    defaultParams: [20],
    description:
      'Average closing price over the last n bars. Smooths out noise to reveal the underlying trend direction.',
    fullName: 'Simple Moving Average',
    id: 'sma',
    indicatorKey: 'sma' as IndicatorMetadataKey,
    linkedExampleId: 'above-below-sma',
    name: 'SMA(n)',
    paramLabels: ['Period'],
    paramTypes: ['period'],
    prefix: 'SMA',
    returns: '(number | null)[]',
    url: 'https://www.investopedia.com/terms/s/sma.asp',
  },
  {
    chipColor: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25',
    configExample: "'EMA(12)'",
    defaultParams: [12],
    description:
      'Like SMA but gives more weight to recent prices, making it faster to react to new price changes.',
    fullName: 'Exponential Moving Average',
    id: 'ema',
    indicatorKey: 'ema' as IndicatorMetadataKey,
    name: 'EMA(n)',
    paramLabels: ['Period'],
    paramTypes: ['period'],
    prefix: 'EMA',
    returns: '(number | null)[]',
    url: 'https://www.investopedia.com/terms/e/ema.asp',
    usageByLang: {
      typescript: `import { Action, type Bar, type Ticker } from './utils';

export async function implementation(
  context: Record<Ticker, Bar[]>,
  _positions: Record<Ticker, number>,
  indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
) {
  const result = {} as Record<Ticker, Action>;
  for (const ticker in context) {
    const ema12 = indicators[ticker]['EMA(12)'].at(-1);
    const ema26 = indicators[ticker]['EMA(26)'].at(-1);
    result[ticker] = ema12 > ema26 ? Action.BUY : Action.SELL;
  }
  return result;
}`,
      javascript: `const { Action } = require('./utils');

async function implementation(context, _positions, indicators) {
  const result = {};
  for (const ticker in context) {
    const ema12 = indicators[ticker]['EMA(12)'].at(-1);
    const ema26 = indicators[ticker]['EMA(26)'].at(-1);
    result[ticker] = ema12 > ema26 ? Action.BUY : Action.SELL;
  }
  return result;
}`,
      python: `from utils import Action

async def implementation(context, positions, indicators):
    result = {}
    for ticker in context:
        ema12 = indicators[ticker]['EMA(12)'][-1]
        ema26 = indicators[ticker]['EMA(26)'][-1]
        result[ticker] = 'BUY' if ema12 > ema26 else 'SELL'
    return result`,
      cpp: `#include "utils.hpp"

std::map<std::string, Action> implementation(
    const Context& context,
    const Positions& positions,
    const Indicators& indicators
) {
    std::map<std::string, Action> result;
    for (auto& [ticker, bars] : context) {
        double ema12 = indicators.at(ticker).at("EMA(12)").back();
        double ema26 = indicators.at(ticker).at("EMA(26)").back();
        result[ticker] = ema12 > ema26 ? Action::BUY : Action::SELL;
    }
    return result;
}`,
    },
  },
  {
    chipColor: 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25',
    configExample: "'RSI(14)'",
    defaultParams: [14],
    description:
      'Momentum oscillator ranging 0 to 100. Values below 30 suggest oversold conditions (potential buy), above 70 suggest overbought (potential sell).',
    fullName: 'Relative Strength Index',
    id: 'rsi',
    indicatorKey: 'rsi' as IndicatorMetadataKey,
    linkedExampleId: 'overbought-oversold',
    name: 'RSI(n)',
    paramLabels: ['Period'],
    paramTypes: ['period'],
    prefix: 'RSI',
    returns: '(number | null)[]',
    url: 'https://www.investopedia.com/terms/r/rsi.asp',
  },
  {
    chipColor: 'bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25',
    configExample: "'ATR(14)'",
    defaultParams: [14],
    description:
      'Measures market volatility over the last n bars. A higher value means larger price swings. Useful for position sizing and setting stop-losses.',
    fullName: 'Average True Range',
    id: 'atr',
    indicatorKey: 'atr' as IndicatorMetadataKey,
    name: 'ATR(n)',
    paramLabels: ['Period'],
    paramTypes: ['period'],
    prefix: 'ATR',
    returns: '(number | null)[]',
    url: 'https://www.investopedia.com/terms/a/atr.asp',
    usageByLang: {
      typescript: `import { Action, type Bar, type Ticker } from './utils';

export async function implementation(
  context: Record<Ticker, Bar[]>,
  _positions: Record<Ticker, number>,
  indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
) {
  const result = {} as Record<Ticker, Action>;
  for (const ticker in context) {
    const atr = indicators[ticker]['ATR(14)'].at(-1);
    const close = context[ticker].at(-1)![4];
    result[ticker] = atr / close < 0.02 ? Action.BUY : Action.HOLD;
  }
  return result;
}`,
      javascript: `const { Action } = require('./utils');

async function implementation(context, _positions, indicators) {
  const result = {};
  for (const ticker in context) {
    const atr = indicators[ticker]['ATR(14)'].at(-1);
    const close = context[ticker].at(-1)[4];
    result[ticker] = atr / close < 0.02 ? Action.BUY : Action.HOLD;
  }
  return result;
}`,
      python: `from utils import Action

async def implementation(context, positions, indicators):
    result = {}
    for ticker in context:
        atr = indicators[ticker]['ATR(14)'][-1]
        close = context[ticker][-1][4]
        result[ticker] = 'BUY' if atr / close < 0.02 else 'HOLD'
    return result`,
      cpp: `#include "utils.hpp"

std::map<std::string, Action> implementation(
    const Context& context,
    const Positions& positions,
    const Indicators& indicators
) {
    std::map<std::string, Action> result;
    for (auto& [ticker, bars] : context) {
        double atr = indicators.at(ticker).at("ATR(14)").back();
        double close = bars.back()[4];
        result[ticker] = atr / close < 0.02 ? Action::BUY : Action::HOLD;
    }
    return result;
}`,
    },
  },
  {
    chipColor: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25',
    configExample: "'LinearRegression(50)'",
    // LinearRegression requires period >= 2 and period <= contextLength - 1.
    // Keep a conservative default that stays valid for common context lengths.
    defaultParams: [10],
    description:
      'Fits a straight trend line through the last n closing prices. Returns the slope (trend direction) and intercept, letting you extrapolate where the price line is headed.',
    fullName: 'Linear Regression',
    id: 'lr',
    indicatorKey: 'linearRegression' as IndicatorMetadataKey,
    linkedExampleId: 'regression-line',
    name: 'LinReg(n)',
    paramLabels: ['Period'],
    paramTypes: ['period'],
    prefix: 'LinearRegression',
    returns: '{ slope: number; intercept: number }',
    url: 'https://www.investopedia.com/terms/r/regression.asp',
  },
  {
    chipColor: 'bg-purple-500/15 border-purple-500/30 text-purple-300 hover:bg-purple-500/25',
    configExample: "'SuperTrend(10,3)'",
    defaultParams: [10, 3],
    description:
      'Trend-following indicator that outputs a direction (UP or DOWN) and a trailing stop level. When direction flips from DOWN to UP it signals a buy; UP to DOWN signals a sell.',
    fullName: 'SuperTrend',
    id: 'supertrend',
    indicatorKey: 'superTrend' as IndicatorMetadataKey,
    linkedExampleId: 'super-trend-direction',
    name: 'SuperTrend',
    paramLabels: ['Period', 'Multiplier'],
    paramTypes: ['period', 'multiplier'],
    prefix: 'SuperTrend',
    returns: '({ superTrendValue: number; direction: number } | null)[]',
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildIndicatorString(prefix: string, params: number[]): string {
  return `${prefix}(${params.join(',')})`;
}

// ─── Indicator Detail Modal ───────────────────────────────────────────────────

function IndicatorDetailModal({
  indicator,
  language,
  onClose,
  onSeeExample,
}: {
  indicator: IndicatorRef;
  language: SupportedLanguage;
  onClose: () => void;
  onSeeExample: (exampleId: string) => void;
}) {
  const [lang, setLang] = useState<SupportedLanguage>(language);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl max-h-[82vh] flex flex-col rounded-2xl bg-slate-900 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/[0.07] shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${indicator.chipColor}`}
              >
                {indicator.name}
              </span>
              <code className="text-xs font-mono text-violet-300/70 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded">
                {indicator.returns}
              </code>
              <a
                href={indicator.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-white/30 hover:text-blue-400 transition-colors ml-auto"
              >
                Docs
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
            <h2 className="text-base font-bold text-white">{indicator.fullName}</h2>
            <p className="text-sm text-white/50 mt-1 leading-relaxed">{indicator.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 ml-4 w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white transition-all cursor-pointer"
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-4">
            {/* Language tabs */}
            <div className="flex items-center gap-1 mb-3">
              {LANG_ORDER.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    lang === l
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                      : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:bg-white/[0.08]'
                  }`}
                >
                  {LANG_LABEL[l]}
                </button>
              ))}
            </div>

            {(() => {
              const code =
                indicator.usageByLang ??
                ALGORITHM_EXAMPLES.find((e) => e.id === indicator.linkedExampleId)?.code;
              return code != null ? (
                <div className="rounded-xl bg-slate-950/70 border border-white/[0.07] overflow-hidden">
                  <pre className="p-4 text-xs font-mono text-white/80 leading-relaxed overflow-x-auto whitespace-pre">
                    {code[lang].trim()}
                  </pre>
                </div>
              ) : null;
            })()}
          </div>
        </div>

        {/* Footer */}
        {indicator.linkedExampleId != null && (
          <div className="flex items-center justify-end px-6 py-4 border-t border-white/[0.07] shrink-0 bg-slate-900/50">
            <button
              type="button"
              onClick={() => onSeeExample(indicator.linkedExampleId!)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm border border-violet-500/40 bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-white hover:from-violet-500/30 hover:to-purple-500/30 hover:-translate-y-0.5 transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              See Full Example
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Indicator Add Row ────────────────────────────────────────────────────────

function ParamStepper({
  value,
  onChange,
  onEmptyChange,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
}: {
  value: number | null;
  onChange: (n: number) => void;
  onEmptyChange?: (isEmpty: boolean) => void;
  min?: number;
  max?: number;
}) {
  const [localValue, setLocalValue] = useState(value == null ? '' : String(value));
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setLocalValue(value == null ? '' : String(value));
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    const n = parseInt(raw, 10);
    if (raw === '' || isNaN(n)) {
      setLocalValue(raw);
      onEmptyChange?.(true);
      return;
    }
    const clamped = Math.min(max, Math.max(min, n));
    setLocalValue(String(clamped));
    onEmptyChange?.(false);
    onChange(clamped);
  }

  function handleBlur() {
    if (localValue === '') {
      onEmptyChange?.(true);
      return;
    }
    const n = parseInt(localValue, 10);
    if (isNaN(n)) {
      onEmptyChange?.(true);
      setLocalValue('');
      return;
    }
    const clamped = Math.min(max, Math.max(min, n));
    onChange(clamped);
    onEmptyChange?.(false);
    setLocalValue(String(clamped));
  }

  return (
    <div className="flex items-center rounded-lg border border-white/10 bg-white/5 overflow-hidden">
      <button
        type="button"
        onClick={() => {
          if (value == null) return;
          onChange(Math.max(min, value - 1));
        }}
        disabled={localValue === '' || value == null || value <= min}
        className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
        </svg>
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={localValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        className="w-8 text-center text-xs font-mono text-white bg-transparent border-none outline-none"
      />
      <button
        type="button"
        onClick={() => {
          if (value == null) return;
          onChange(Math.min(max, value + 1));
        }}
        disabled={localValue === '' || value == null || value >= max}
        className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}

function IndicatorAddRow({
  indicator: indicatorRef,
  existingIndicators,
  contextLength,
  onAdd,
  onOpenDocs,
}: {
  indicator: IndicatorRef;
  existingIndicators: string[];
  contextLength: number;
  onAdd: (indicatorString: string) => void;
  onOpenDocs: () => void;
}) {
  const [params, setParams] = useState<(number | null)[]>(() => {
    if (contextLength < 20) return indicatorRef.defaultParams.map(() => null);
    return indicatorRef.defaultParams;
  });
  const [emptyParams, setEmptyParams] = useState<Set<number>>(() => {
    if (contextLength < 20) return new Set(indicatorRef.defaultParams.map((_, i) => i));
    return new Set();
  });
  const hasEmptyInput = emptyParams.size > 0;
  const indicatorString = hasEmptyInput
    ? ''
    : buildIndicatorString(indicatorRef.prefix, params as number[]);
  const isAdded = indicatorString !== '' && existingIndicators.includes(indicatorString);
  const atLimit = existingIndicators.length >= MAX_INDICATORS_COUNT;

  function handleEmptyChange(paramIndex: number, isEmpty: boolean) {
    setEmptyParams((prev) => {
      const next = new Set(prev);
      if (isEmpty) next.add(paramIndex);
      else next.delete(paramIndex);
      return next;
    });
  }

  function effectiveMax(paramIndex: number): number {
    if (indicatorRef.paramTypes[paramIndex] === 'multiplier') return MAX_INDICATOR_MULTIPLIER;
    return maxPeriodByIndicatorByContextLength[indicatorRef.indicatorKey](contextLength);
  }

  function effectiveMin(paramIndex: number): number {
    if (indicatorRef.paramTypes[paramIndex] === 'multiplier') return 1;
    return minPeriodByIndicator[indicatorRef.indicatorKey];
  }

  function handleChange(index: number, n: number) {
    setParams((prev) => prev.map((v, i) => (i === index ? n : v)));
  }

  const labelText = indicatorRef.prefix === 'LinearRegression' ? 'LinReg' : indicatorRef.prefix;

  const addBtn = (
    <button
      type="button"
      onClick={() => onAdd(indicatorString)}
      disabled={isAdded || atLimit || hasEmptyInput}
      title={
        isAdded
          ? 'Already added'
          : atLimit
            ? `Limit of ${MAX_INDICATORS_COUNT} indicators reached`
            : hasEmptyInput
              ? 'Enter a valid value'
              : `Add ${indicatorString}`
      }
      className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${
        isAdded || atLimit
          ? 'bg-white/[0.03] border-white/[0.06] text-white/20 cursor-not-allowed'
          : 'bg-white/5 border-white/10 text-white/40 hover:bg-blue-500/20 hover:border-blue-500/40 hover:text-blue-300 cursor-pointer'
      }`}
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );

  if (params.length > 1) {
    return (
      <div className="py-1.5">
        <button
          type="button"
          onClick={onOpenDocs}
          title={indicatorRef.fullName}
          className={`text-[11px] font-mono font-semibold px-2 py-1 rounded-lg border transition-all cursor-pointer mb-1.5 ${indicatorRef.chipColor}`}
        >
          {labelText}
        </button>
        <div className="flex items-center gap-1.5">
          {params.map((val, i) => (
            <ParamStepper
              key={i}
              value={val}
              onChange={(n) => handleChange(i, n)}
              onEmptyChange={(empty) => handleEmptyChange(i, empty)}
              min={effectiveMin(i)}
              max={effectiveMax(i)}
            />
          ))}
          {addBtn}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 py-1">
      <button
        type="button"
        onClick={onOpenDocs}
        title={indicatorRef.fullName}
        className={`shrink-0 text-[11px] font-mono font-semibold px-2 py-1 rounded-lg border transition-all cursor-pointer w-[4.5rem] text-center ${indicatorRef.chipColor}`}
      >
        {labelText}
      </button>
      <ParamStepper
        value={params[0]}
        onChange={(n) => handleChange(0, n)}
        onEmptyChange={(empty) => handleEmptyChange(0, empty)}
        min={effectiveMin(0)}
        max={effectiveMax(0)}
      />
      {addBtn}
    </div>
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
  indicators,
  submissions,
  onCancel,
  onOpenExamples,
  onOpenIndicatorDocs,
  onAddIndicator,
  onRemoveIndicator,
}: {
  algorithm: AlgorithmWithId;
  indicators: string[];
  submissions: SubmissionSummary[];
  onCancel: (publicId: string) => void;
  onOpenExamples: () => void;
  onOpenIndicatorDocs: (id: string) => void;
  onAddIndicator: (indicatorString: string) => void;
  onRemoveIndicator: (indicator: string) => void;
}) {
  const navigate = useNavigate();
  const tickers = getTickers(algorithm);
  const typeColor = TYPE_COLOR[algorithm.type] ?? TYPE_COLOR[AlgorithmType.NORMAL];
  const pastRuns = submissions.filter((s) => s.algorithmIds.includes(algorithm.id)).slice(0, 5);

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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          }
          label="Language"
          value={LANG_LABEL[algorithm.language] ?? algorithm.language}
        />
        <InfoRow
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          label="Timeframe"
          value={algorithm.aggregate}
        />
        <InfoRow
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          }
          label="Context Length"
          value={`${algorithm.contextLength} bars`}
        />
        <InfoRow
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          }
          label="Max Holding"
          value={`${((algorithm.algorithmMaxHoldingProportion ?? 0.95) * 100).toFixed(0)}%`}
        />
        {algorithm.type === AlgorithmType.TOP_K && (
          <InfoRow
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
            }
            label="K (top tickers)"
            value={(algorithm as { k: number }).k}
          />
        )}
        <InfoRow
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
              />
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

      {/* Indicators section */}
      <div className="px-5 pb-4 border-t border-white/[0.07] pt-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Indicators
          </span>
          {indicators.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300">
              {indicators.length}
            </span>
          )}
        </div>

        {/* Active indicators */}
        {indicators.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {indicators.map((ind) => {
              const ref = INDICATORS_REF.find((r) => ind.startsWith(r.prefix + '('));
              return (
                <div
                  key={ind}
                  className={`flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg border text-[11px] font-mono font-semibold ${ref?.chipColor ?? 'bg-white/5 border-white/10 text-white/60'}`}
                >
                  <span>{ind}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveIndicator(ind)}
                    className="w-3.5 h-3.5 flex items-center justify-center rounded opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <svg
                      className="w-2.5 h-2.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Inline add rows */}
        <div className="flex flex-col">
          {INDICATORS_REF.map((ind) => (
            <IndicatorAddRow
              key={ind.id}
              indicator={ind}
              existingIndicators={indicators}
              contextLength={algorithm.contextLength}
              onAdd={onAddIndicator}
              onOpenDocs={() => onOpenIndicatorDocs(ind.id)}
            />
          ))}
        </div>
      </div>

      {/* Examples button */}
      <div className="px-5 pb-4">
        <button
          type="button"
          onClick={onOpenExamples}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/50 hover:text-white/80 transition-all text-xs cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Browse Examples
        </button>
      </div>

      {/* Past Runs */}
      {pastRuns.length > 0 && (
        <div className="p-5 border-t border-white/[0.07]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Past Runs
            </span>
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
                <div key={s.publicId} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        isFinished
                          ? `/backtest/${s.publicId}`
                          : `/backtests?algorithm=${algorithm.id}`,
                      )
                    }
                    className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors text-left cursor-pointer group"
                  >
                    <span className={`text-xs font-medium ${color}`}>{label}</span>
                    <span className="text-xs text-white/30 group-hover:text-white/50 transition-colors">
                      {timeAgo(new Date(s.createdAt))}
                    </span>
                  </button>
                  {isCancellable && (
                    <button
                      type="button"
                      title="Cancel backtest"
                      onClick={() => onCancel(s.publicId)}
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-red-500/20 border border-white/[0.06] hover:border-red-500/40 text-white/30 hover:text-red-400 transition-all cursor-pointer"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
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

  const [indicators, setIndicators] = useState<string[]>(algorithm.indicators ?? []);

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

  const { mutate: saveIndicators } = useMutation(
    trpcCredentials.algorithms.updateAlgorithmIndicators.mutationOptions({
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to update indicators');
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpcCredentials.algorithms.getAlgorithm.queryKey({ id: algorithm.id }),
        });
      },
    }),
  );

  function handleAddIndicator(indicatorString: string) {
    if (indicators.includes(indicatorString)) return;
    if (indicators.length >= MAX_INDICATORS_COUNT) {
      toast.error(`You can add at most ${MAX_INDICATORS_COUNT} indicators per algorithm`);
      return;
    }
    const next = [...indicators, indicatorString];
    setIndicators(next);
    saveIndicators({ id: algorithm.id, indicators: next });
  }

  function handleRemoveIndicator(indicatorString: string) {
    const next = indicators.filter((i) => i !== indicatorString);
    setIndicators(next);
    saveIndicators({ id: algorithm.id, indicators: next });
  }

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

  const { mutateAsync: createAlgorithm, isPending: isCreating } = useMutation(
    trpcCredentials.algorithms.createAlgorithm.mutationOptions({
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to create algorithm');
      },
    }),
  );

  const { mutate: deleteAlgorithm } = useMutation(
    trpcCredentials.algorithms.deleteAlgorithm.mutationOptions({
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to delete algorithm');
      },
    }),
  );

  const { data: allAlgorithms = [] } = useQuery(
    trpcCredentials.algorithms.getAlgorithms.queryOptions(),
  );

  type PendingCreate = { example: AlgorithmExample; lang: SupportedLanguage; conflictId: string };
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null);

  async function handleCreateFromExample(example: AlgorithmExample, lang: SupportedLanguage) {
    const existing = allAlgorithms.find((a) => a.name === example.name);
    if (existing) {
      setPendingCreate({ example, lang, conflictId: existing.id });
      return;
    }
    await doCreateFromExample(example, lang);
  }

  async function doCreateFromExample(
    example: AlgorithmExample,
    lang: SupportedLanguage,
    overwriteId?: string,
  ) {
    const base = {
      aggregate: example.aggregate as AnyUserAlgorithmType['aggregate'],
      contextLength: example.contextLength,
      indicators: example.indicators as AnyUserAlgorithmType['indicators'],
      language: lang,
      name: example.name,
      userAlgorithmImplementationCode: example.code[lang].trimStart(),
    };
    let input: Parameters<typeof createAlgorithm>[0];
    if (example.algorithmType === 1) {
      input = {
        ...base,
        ticker: example.ticker! as UserTicker,
        type: 1 as const,
      };
    } else if (example.algorithmType === 2) {
      input = {
        ...base,
        tickers: example.tickers! as UserTicker[],
        k: example.k!,
        type: 2 as const,
      };
    } else {
      input = { ...base, tickers: example.tickers! as UserTicker[], type: 0 as const };
    }
    if (overwriteId) deleteAlgorithm({ id: overwriteId });
    const result = await createAlgorithm(input);
    navigate(`/algorithms/${result.id}`);
  }

  const [showRunModal, setShowRunModal] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [examplesInitialId, setExamplesInitialId] = useState<string | undefined>(undefined);
  const [activeIndicator, setActiveIndicator] = useState<IndicatorRef | null>(null);

  const isRunning = isPendingIds.has(algorithm.id) && cooldownSecondsLeft > 0;
  const isBacktestDisabled = isRunning || cooldownSecondsLeft > 0;

  function openExamples(initialId?: string) {
    setExamplesInitialId(initialId);
    setShowExamples(true);
  }

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
      <div
        className="flex flex-col bg-slate-950 text-white font-sans overflow-hidden"
        style={{ height: 'calc(100vh - 79px)' }}
      >
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span className="hidden sm:inline">Algorithms</span>
            </button>
            <span className="text-white/20">/</span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-white text-sm truncate">{algorithm.name}</span>
              {isDirty && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0"
                  title="Unsaved changes"
                />
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
                  Saving...
                </>
              ) : (
                <>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                    />
                  </svg>
                  Save
                </>
              )}
            </button>

            {/* Run backtest */}
            <button
              type="button"
              disabled={isBacktestDisabled}
              title={
                cooldownSecondsLeft > 0 && !isRunning
                  ? `Please wait ${cooldownSecondsLeft}s before submitting another backtest`
                  : undefined
              }
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
                  Running...
                </>
              ) : cooldownSecondsLeft > 0 ? (
                <>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Wait {cooldownSecondsLeft}s
                </>
              ) : (
                <>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
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
              indicators={indicators}
              submissions={submissions}
              onCancel={(publicId) => cancelBacktest({ publicId })}
              onOpenExamples={() => openExamples()}
              onOpenIndicatorDocs={(id) => {
                const ind = INDICATORS_REF.find((i) => i.id === id);
                if (ind) setActiveIndicator(ind);
              }}
              onAddIndicator={handleAddIndicator}
              onRemoveIndicator={handleRemoveIndicator}
            />
          </div>

          {/* Divider */}
          <div className="w-px bg-white/[0.07] shrink-0" />

          {/* Editor panel */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Editor header */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.07] bg-slate-900/30 shrink-0">
              <span className="text-xs text-white/30 font-mono">
                {algorithm.name.replaceAll(' ', '_')}.
                {getExtension(algorithm.language as SupportedLanguage)}
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
                  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                    allowJs: true,
                    module: monaco.languages.typescript.ModuleKind.ESNext,
                    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
                    noUnusedLocals: false,
                    noUnusedParameters: false,
                    strict: false,
                    target: monaco.languages.typescript.ScriptTarget.ESNext,
                  });
                  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                    allowJs: true,
                    checkJs: false,
                    module: monaco.languages.typescript.ModuleKind.CommonJS,
                    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
                    target: monaco.languages.typescript.ScriptTarget.ESNext,
                  });
                  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                    noSuggestionDiagnostics: true,
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
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                  fontLigatures: true,
                  fontSize: 14,
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

      {activeIndicator != null && (
        <IndicatorDetailModal
          indicator={activeIndicator}
          language={algorithm.language as SupportedLanguage}
          onClose={() => setActiveIndicator(null)}
          onSeeExample={(exampleId) => {
            setActiveIndicator(null);
            openExamples(exampleId);
          }}
        />
      )}

      {showExamples && (
        <ExamplesModal
          language={algorithm.language as SupportedLanguage}
          initialExampleId={examplesInitialId}
          onCreateFromExample={(example, lang) => {
            setShowExamples(false);
            void handleCreateFromExample(example, lang);
          }}
          onClose={() => setShowExamples(false)}
        />
      )}

      {pendingCreate != null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setPendingCreate(null)}
          />
          <div
            className="relative w-full max-w-sm rounded-2xl bg-slate-900 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1">
              <svg
                className="w-4 h-4 text-amber-400 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h3 className="text-sm font-bold text-white">Name already taken</h3>
            </div>
            <p className="text-sm text-white/50 leading-relaxed mb-5">
              You already have an algorithm called{' '}
              <span className="text-white/80 font-medium">"{pendingCreate.example.name}"</span>.
              Replacing it will permanently delete that algorithm.
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setPendingCreate(null)}
                className="px-4 py-2 rounded-xl text-sm border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCreating}
                onClick={() => {
                  const p = pendingCreate;
                  setPendingCreate(null);
                  void doCreateFromExample(p.example, p.lang, p.conflictId);
                }}
                className="px-4 py-2 rounded-xl text-sm border border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25 hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-50"
              >
                Replace it
              </button>
            </div>
          </div>
        </div>
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
