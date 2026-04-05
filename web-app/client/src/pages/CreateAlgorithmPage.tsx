import { Tooltip } from '@client/components/Tooltip';
import { CheckIcon, NormalIcon, SimpleIcon, Spinner, TopKIcon } from '@client/icons';
import { getDefaultImplementationCode } from '@client/lib/defaultAlgorithmCode';
import { trpcCredentials } from '@client/lib/trpc';
import {
  AlgorithmType,
  LANGUAGES,
  TICKER_COMPANY_NAMES,
  TIMEFRAMES_WITH_LABELS,
  type TickerValue,
} from '@shared/api';
import { ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT } from '@shared/constants';
import { tickers as TICKERS, type Timestamp } from '@shared/trading-constants';
import { type AnyUserAlgorithmType, type SupportedLanguage } from '@shared/worker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────

const NAME_REGEX = /^[a-zA-Z0-9\-() ]+$/;
const BLOCKED_NAMES = ['runner', 'utils'];

/** Tailwind class to hide number input spin buttons (webkit + Firefox) */
const INPUT_NUMBER_NO_SPINNER =
  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0';

// ─── Validation ───────────────────────────────────────────────────────────────

function validateName(name: string): string | null {
  if (name.length === 0) return 'Name is required';
  if (name.length > 64) return 'Name must be 64 characters or fewer';
  if (!NAME_REGEX.test(name))
    return 'Only letters, numbers, dashes, parentheses, and spaces allowed';
  if (BLOCKED_NAMES.includes(name)) return `Name cannot be '${name}'`;
  return null;
}

// ─── Step indicator ────────────────────────────────────────────────────────────

const STEP_LABELS = ['Basics', 'Settings', 'Tickers'] as const;

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-4">
      {STEP_LABELS.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const isActive = n === step;
        const isDone = n < step;
        return (
          <div key={n} className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all overflow-hidden ${
                isActive
                  ? 'border-0 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 text-white shadow-[0_0_0_2px_rgba(255,255,255,0.15)]'
                  : isDone
                    ? 'border-2 bg-blue-500/20 border-blue-500/60 text-blue-300'
                    : 'border-2 bg-white/5 border-white/20 text-white/40'
              }`}
            >
              {isDone ? <CheckIcon /> : n}
            </div>
            <span
              className={`text-base font-semibold whitespace-nowrap ${
                isActive ? 'text-white' : isDone ? 'text-white/50' : 'text-white/30'
              }`}
            >
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && <span className="text-white/25 mx-1 text-lg">/</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Wizard state ─────────────────────────────────────────────────────────────

interface WizardState {
  algorithmType: (typeof AlgorithmType)[keyof typeof AlgorithmType] | null;
  name: string;
  language: SupportedLanguage | null;
  timeframe: Timestamp | null;
  contextLength: number;
  algorithmMaxHoldingProportion: number;
  selectedTickers: string[];
  singleTicker: string | null;
  k: number;
}

const INITIAL_STATE: WizardState = {
  algorithmMaxHoldingProportion: 0.95,
  algorithmType: null,
  contextLength: 20,
  k: 1,
  language: null,
  name: '',
  selectedTickers: [],
  singleTicker: null,
  timeframe: '60min',
};

// ─── Main component ───────────────────────────────────────────────────────────

const HEADER_OFFSET = '4rem'; // match app header height
/** Fixed height for content so the distance between step tracker and Cancel/Continue stays the same */
const STEP_CONTENT_HEIGHT = 320;

export function CreateAlgorithmPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [tickerSearch, setTickerSearch] = useState('');
  /** Local string for bounded inputs: allow empty and digits-only; clamp/shake on out-of-bounds */
  const [contextLengthStr, setContextLengthStr] = useState(() =>
    String(INITIAL_STATE.contextLength),
  );
  const [maxHoldingStr, setMaxHoldingStr] = useState(() =>
    String(INITIAL_STATE.algorithmMaxHoldingProportion),
  );
  const [kInputStr, setKInputStr] = useState('');

  const [shakeContextLength, setShakeContextLength] = useState(false);
  const [shakeMaxHolding, setShakeMaxHolding] = useState(false);
  const [shakeK, setShakeK] = useState(false);

  const maxK = state.selectedTickers.length || 1;
  const MAX_CONTEXT_LENGTH = 9999;
  const MAX_MAX_HOLDING_INPUT_DIGITS = 6;

  useEffect(() => {
    if (state.k > maxK) {
      setState((s) => ({ ...s, k: maxK }));
      setKInputStr('');
    }
  }, [maxK, state.k]);

  function triggerShake(setter: (v: boolean) => void) {
    setter(true);
    setTimeout(() => setter(false), 400);
  }

  const nameError = state.name.length > 0 ? validateName(state.name) : null;
  const step1Valid =
    state.algorithmType !== null && state.name.length > 0 && !validateName(state.name);

  const step2Valid =
    state.language !== null &&
    state.timeframe !== null &&
    state.contextLength >= 1 &&
    state.algorithmMaxHoldingProportion >= 0.01 &&
    state.algorithmMaxHoldingProportion <= ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT;

  const tickersValid =
    state.algorithmType === AlgorithmType.SIMPLE
      ? state.singleTicker !== null
      : state.selectedTickers.length > 0;
  const kValid =
    state.algorithmType !== AlgorithmType.TOP_K ||
    (state.k >= 1 && state.k <= state.selectedTickers.length);
  const step3Valid = tickersValid && kValid;

  const { mutateAsync: createAlgorithm, isPending } = useMutation(
    trpcCredentials.algorithms.createAlgorithm.mutationOptions({
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to create algorithm');
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpcCredentials.algorithms.getAlgorithms.queryKey(),
        });
      },
    }),
  );

  function buildPayload(): AnyUserAlgorithmType {
    const defaultCode = getDefaultImplementationCode(
      state.language!,
      state.algorithmType!,
      state.algorithmType === AlgorithmType.TOP_K ? state.selectedTickers : undefined,
    );
    const base = {
      aggregate: state.timeframe!,
      algorithmMaxHoldingProportion: state.algorithmMaxHoldingProportion,
      contextLength: state.contextLength,
      language: state.language!,
      name: state.name,
      userAlgorithmImplementationCode: defaultCode,
    };
    if (state.algorithmType === AlgorithmType.SIMPLE) {
      return { ...base, ticker: state.singleTicker! as TickerValue, type: AlgorithmType.SIMPLE };
    }
    if (state.algorithmType === AlgorithmType.TOP_K) {
      return {
        ...base,
        k: state.k,
        tickers: state.selectedTickers as TickerValue[],
        type: AlgorithmType.TOP_K,
      };
    }
    return { ...base, tickers: state.selectedTickers as TickerValue[], type: AlgorithmType.NORMAL };
  }

  async function handleCreate() {
    const result = await createAlgorithm(buildPayload());
    toast.success('Algorithm created');
    navigate(`/algorithms/${result.id}`);
  }

  function toggleTicker(ticker: string) {
    setState((s) => ({
      ...s,
      selectedTickers: s.selectedTickers.includes(ticker)
        ? s.selectedTickers.filter((t) => t !== ticker)
        : [...s.selectedTickers, ticker],
    }));
  }

  // ── Step 1 ────────────────────────────────────────────────────────────────
  const ALGO_TYPES = [
    {
      border: 'border-blue-500/50',
      description:
        'Trade across multiple stocks at once without worrying about position sizing, allowing you to focus on strategy.',
      glow: 'shadow-[0_0_30px_rgba(59,130,246,0.12)]',
      gradient: 'from-blue-500/20 to-cyan-500/20',
      Icon: NormalIcon,
      iconColor: 'text-blue-400',
      label: 'Normal',
      tagline: 'Multi-ticker portfolio strategy',
      type: AlgorithmType.NORMAL,
    },
    {
      border: 'border-emerald-500/50',
      description: 'Trade on a single ticker. Great for getting started.',
      glow: 'shadow-[0_0_30px_rgba(16,185,129,0.12)]',
      gradient: 'from-emerald-500/20 to-teal-500/20',
      Icon: SimpleIcon,
      iconColor: 'text-emerald-400',
      label: 'Simple',
      tagline: 'Focus on one ticker',
      type: AlgorithmType.SIMPLE,
    },
    {
      border: 'border-purple-500/50',
      description:
        'Warning: Can generate alpha if used properly. Rank each ticker and buy the K best.',
      glow: 'shadow-[0_0_30px_rgba(168,85,247,0.12)]',
      gradient: 'from-purple-500/20 to-pink-500/20',
      Icon: TopKIcon,
      iconColor: 'text-purple-400',
      label: 'Top-K',
      tagline: 'Score and rank multiple tickers',
      type: AlgorithmType.TOP_K,
    },
  ] as const;

  function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
      <p className="text-white/50 text-sm mb-2 uppercase tracking-wider font-semibold">
        {children}
      </p>
    );
  }

  // Step 1: Type + name — content fills available space, centered
  const step1 = (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="w-full">
        <SectionLabel>Strategy type</SectionLabel>
        <div className="grid grid-cols-3 gap-4 w-full">
          {ALGO_TYPES.map(
            ({ type, label, tagline, description, Icon, gradient, border, iconColor, glow }) => {
              const isSelected = state.algorithmType === type;
              return (
                <Tooltip key={label} content={description}>
                  <button
                    type="button"
                    onClick={() => setState((s) => ({ ...s, algorithmType: type }))}
                    className={`relative w-full h-[168px] p-5 rounded-xl border text-left cursor-pointer transition-all group flex flex-col ${
                      isSelected
                        ? `bg-gradient-to-br ${gradient} ${border} ${glow}`
                        : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                        <CheckIcon />
                      </div>
                    )}
                    <div
                      className={`mb-2 ${isSelected ? iconColor : 'text-white/40 group-hover:text-white/60'}`}
                    >
                      <Icon className="w-14 h-14" />
                    </div>
                    <div className="font-bold text-white text-lg">{label}</div>
                    <div
                      className={`text-sm min-h-[2.5rem] ${isSelected ? iconColor : 'text-white/40'}`}
                    >
                      {tagline}
                    </div>
                  </button>
                </Tooltip>
              );
            },
          )}
        </div>
      </div>
      <div className="w-full">
        <SectionLabel>Algorithm name</SectionLabel>
        <input
          type="text"
          value={state.name}
          onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
          placeholder="e.g. Mean Reversion SPY"
          maxLength={64}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 text-white placeholder-white/25 outline-none text-base"
        />
        {nameError && <p className="mt-1 text-xs text-red-400">{nameError}</p>}
      </div>
    </div>
  );

  // Step 2: Language, timeframe, context, max holding — fills space, centered
  const step2 = (
    <div className="flex flex-col gap-6 w-full">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <SectionLabel>Language</SectionLabel>
          <div className="flex flex-col items-center gap-2.5">
            <div className="flex gap-2.5">
              {LANGUAGES.slice(0, 2).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setState((s) => ({ ...s, language: value }))}
                  className={`px-4 py-2.5 rounded-lg text-base font-medium border cursor-pointer ${
                    state.language === value
                      ? 'bg-blue-500/25 border-blue-500/50 text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex justify-center gap-2.5">
              {LANGUAGES.slice(2, 4).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setState((s) => ({ ...s, language: value }))}
                  className={`px-4 py-2.5 rounded-lg text-base font-medium border cursor-pointer ${
                    state.language === value
                      ? 'bg-blue-500/25 border-blue-500/50 text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <SectionLabel>Timeframe</SectionLabel>
          <div className="flex flex-col items-center gap-2.5">
            <div className="flex gap-2.5">
              {TIMEFRAMES_WITH_LABELS.slice(0, 3).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setState((s) => ({ ...s, timeframe: value }))}
                  className={`px-4 py-2.5 rounded-lg text-base font-medium border cursor-pointer ${
                    state.timeframe === value
                      ? 'bg-blue-500/25 border-blue-500/50 text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex justify-center gap-2.5">
              {TIMEFRAMES_WITH_LABELS.slice(3, 5).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setState((s) => ({ ...s, timeframe: value }))}
                  className={`px-4 py-2.5 rounded-lg text-base font-medium border cursor-pointer ${
                    state.timeframe === value
                      ? 'bg-blue-500/25 border-blue-500/50 text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Tooltip
          content="Number of bars (at selected timeframe) passed to your strategy each step."
          className="overflow-hidden"
        >
          <div className="overflow-hidden">
            <SectionLabel>Context length (bars)</SectionLabel>
            <input
              type="text"
              inputMode="numeric"
              value={contextLengthStr}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                if (raw === '') {
                  setContextLengthStr('');
                  setState((s) => ({ ...s, contextLength: 0 }));
                  return;
                }
                const n = parseInt(raw, 10);
                if (n >= 1 && n <= MAX_CONTEXT_LENGTH) {
                  setContextLengthStr(raw);
                  setState((s) => ({ ...s, contextLength: n }));
                } else {
                  triggerShake(setShakeContextLength);
                }
              }}
              className={`w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 text-white outline-none text-base ${INPUT_NUMBER_NO_SPINNER} ${shakeContextLength ? 'input-shake' : ''}`}
            />
          </div>
        </Tooltip>
        <Tooltip
          content="Maximum portfolio invested in market. e.g., 0.95=95%."
          className="overflow-hidden"
        >
          <div className="overflow-hidden">
            <SectionLabel>Max holding (0–{ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT})</SectionLabel>
            <input
              type="text"
              inputMode="decimal"
              value={maxHoldingStr}
              onChange={(e) => {
                const withDots = e.target.value.replace(/[^0-9.]/g, '');
                const parts = withDots.split('.');
                const raw = parts.length > 2 ? `${parts[0]}.${parts[1]}` : withDots;
                if (raw.length > MAX_MAX_HOLDING_INPUT_DIGITS) return;
                if (raw === '' || raw === '.') {
                  setMaxHoldingStr(raw);
                  setState((s) => ({ ...s, algorithmMaxHoldingProportion: 0 }));
                  return;
                }
                const n = parseFloat(raw);
                if (Number.isNaN(n)) return;
                if (n > ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT) {
                  triggerShake(setShakeMaxHolding);
                  return;
                }
                setMaxHoldingStr(raw);
                setState((s) => ({ ...s, algorithmMaxHoldingProportion: n }));
              }}
              className={`w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 text-white outline-none text-base ${INPUT_NUMBER_NO_SPINNER} ${shakeMaxHolding ? 'input-shake' : ''}`}
            />
          </div>
        </Tooltip>
      </div>
    </div>
  );

  // Filter tickers by symbol or company name
  const tickerFilter = tickerSearch.trim().toLowerCase();
  const filteredTickers = tickerFilter
    ? TICKERS.filter(
        (t) =>
          t.toLowerCase().includes(tickerFilter) ||
          TICKER_COMPANY_NAMES[t].toLowerCase().includes(tickerFilter),
      )
    : [...TICKERS];

  // Step 3: Tickers + K — fills space; grid scrolls if needed
  const step3 = (
    <div className="flex flex-col gap-4 w-full min-h-0 flex-1">
      <div className="flex flex-col w-full min-h-0 flex-1">
        <div className="mb-1">
          <SectionLabel>
            {state.algorithmType === AlgorithmType.SIMPLE ? 'Ticker' : 'Tickers'}
            {state.algorithmType !== AlgorithmType.SIMPLE && state.selectedTickers.length > 0 && (
              <span className="ml-2 text-blue-400 normal-case font-normal text-xs">
                {state.selectedTickers.length} selected
              </span>
            )}
          </SectionLabel>
          <input
            type="text"
            value={tickerSearch}
            onChange={(e) => setTickerSearch(e.target.value)}
            placeholder="Search by ticker or company name (e.g. AAPL, Apple)"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 text-white placeholder-white/30 outline-none text-base"
          />
        </div>
        <div className="flex flex-wrap gap-2.5 content-start overflow-y-auto min-h-0 mt-3">
          {filteredTickers.length === 0 ? (
            <p className="text-white/40 text-sm py-4">
              {tickerFilter
                ? `No tickers match "${tickerSearch.trim()}". Try a different ticker or company name.`
                : 'No tickers available.'}
            </p>
          ) : (
            filteredTickers.map((ticker) => {
              const isSimple = state.algorithmType === AlgorithmType.SIMPLE;
              const isSelected = isSimple
                ? state.singleTicker === ticker
                : state.selectedTickers.includes(ticker);
              return (
                <button
                  key={ticker}
                  type="button"
                  onClick={() => {
                    if (isSimple) {
                      setState((s) => ({ ...s, singleTicker: ticker }));
                    } else {
                      toggleTicker(ticker);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-base font-mono font-semibold border cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-500/25 to-purple-500/25 border-blue-500/50 text-white shadow-[0_0_8px_rgba(99,102,241,0.12)]'
                      : 'bg-white/5 border-white/10 text-white/55 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {ticker}
                </button>
              );
            })
          )}
        </div>
      </div>
      {state.algorithmType === AlgorithmType.TOP_K && (
        <Tooltip
          content="For Top-K: how many of the selected tickers to hold at once. Your strategy outputs a score per ticker; the top K by score are held."
          className="shrink-0"
        >
          <div className="shrink-0">
            <SectionLabel>K — top tickers to hold</SectionLabel>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={kInputStr !== '' ? kInputStr : state.k >= 1 ? String(state.k) : ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  if (raw === '') {
                    setKInputStr('');
                    setState((s) => ({ ...s, k: 0 }));
                    return;
                  }
                  const n = parseInt(raw, 10);
                  if (n >= 1 && n <= maxK) {
                    setKInputStr(raw);
                    setState((s) => ({ ...s, k: n }));
                  } else {
                    triggerShake(setShakeK);
                  }
                }}
                className={`w-20 px-2.5 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-blue-500/50 text-white outline-none text-sm ${INPUT_NUMBER_NO_SPINNER} ${shakeK ? 'input-shake' : ''}`}
              />
              <span className="text-xs text-white/40">
                of {state.selectedTickers.length || '?'} selected
              </span>
            </div>
            {state.k > state.selectedTickers.length && state.selectedTickers.length > 0 && (
              <p className="mt-0.5 text-xs text-red-400">K cannot exceed selected tickers</p>
            )}
          </div>
        </Tooltip>
      )}
    </div>
  );

  return (
    <div
      className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col font-sans text-white overflow-hidden"
      style={{
        bottom: 0,
        left: 0,
        position: 'fixed',
        right: 0,
        top: HEADER_OFFSET,
      }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-blue-500/5 blur-3xl rounded-full animate-pulse" />
        <div
          className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-purple-500/5 blur-3xl rounded-full animate-pulse"
          style={{ animationDelay: '1s' }}
        />
      </div>

      {/* Centered block: step tracker + content (fixed height) + buttons — distance between header and footer unchanged */}
      <div className="flex-1 flex items-center justify-center px-6 py-6 min-h-0 overflow-hidden">
        <div className="w-full max-w-2xl flex flex-col items-center gap-6 shrink-0">
          <StepIndicator step={step} />
          <div
            className="w-full overflow-hidden flex flex-col"
            style={{ height: STEP_CONTENT_HEIGHT }}
          >
            <div className="flex-1 flex flex-col justify-center min-h-0 overflow-auto">
              {step === 1 && step1}
              {step === 2 && step2}
              {step === 3 && step3}
            </div>
          </div>
          <div className="flex items-center gap-4 w-full">
            <button
              type="button"
              onClick={() => {
                if (step === 1) navigate('/algorithms');
                else setStep((s) => (s - 1) as 1 | 2 | 3);
              }}
              className="flex-1 min-w-0 py-4 px-6 rounded-xl font-semibold text-base border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {step === 1 ? (
                'Cancel'
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Back
                </>
              )}
            </button>

            {step === 1 && (
              <button
                type="button"
                disabled={!step1Valid}
                onClick={() => setStep(2)}
                className="flex-1 min-w-0 py-4 px-8 rounded-xl font-semibold text-base border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:-translate-y-0.5 bg-gradient-to-r from-blue-500/25 to-purple-500/25 border-blue-500/40 hover:border-blue-500/60 text-white flex items-center justify-center gap-2"
              >
                Continue
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}
            {step === 2 && (
              <button
                type="button"
                disabled={!step2Valid}
                onClick={() => setStep(3)}
                className="flex-1 min-w-0 py-4 px-8 rounded-xl font-semibold text-base border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:-translate-y-0.5 bg-gradient-to-r from-blue-500/25 to-purple-500/25 border-blue-500/40 hover:border-blue-500/60 text-white flex items-center justify-center gap-2"
              >
                Continue
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                disabled={!step3Valid || isPending}
                onClick={handleCreate}
                className="flex-1 min-w-0 py-4 px-8 rounded-xl font-semibold text-base border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:-translate-y-0.5 bg-gradient-to-r from-blue-500/25 to-purple-500/25 border-blue-500/40 hover:border-blue-500/60 text-white flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <Spinner />
                    Creating…
                  </>
                ) : (
                  <>
                    Create & Open Editor
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                      />
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
