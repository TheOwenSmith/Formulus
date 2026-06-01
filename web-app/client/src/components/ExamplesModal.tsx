import { ALGORITHM_EXAMPLES, type AlgorithmExample } from '@shared/constants/examples';
import type { SupportedLanguage } from '@shared/constants/trading';
import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  language: SupportedLanguage;
  initialExampleId?: string;
  onCreateFromExample: (example: AlgorithmExample, language: SupportedLanguage) => void;
  onClose: () => void;
};

type TypeFilter = 'all' | 0 | 1 | 2;

const TYPE_LABELS: Record<number, string> = { 0: 'Normal', 1: 'Simple', 2: 'Top-K' };

const TYPE_COLORS: Record<number, string> = {
  0: 'from-blue-500/20 to-cyan-500/20 border-blue-500/40 text-blue-300',
  1: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-300',
  2: 'from-purple-500/20 to-pink-500/20 border-purple-500/40 text-purple-300',
};

const LANG_LABELS: Record<SupportedLanguage, string> = {
  cpp: 'C++',
  javascript: 'JavaScript',
  python: 'Python',
  typescript: 'TypeScript',
};

const LANG_ORDER: SupportedLanguage[] = ['typescript', 'javascript', 'python', 'cpp'];

// ─── Component ────────────────────────────────────────────────────────────────

export function ExamplesModal({ language, initialExampleId, onCreateFromExample, onClose }: Props) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selected, setSelected] = useState<AlgorithmExample | null>(
    () =>
      (initialExampleId != null
        ? ALGORITHM_EXAMPLES.find((e) => e.id === initialExampleId)
        : null) ??
      ALGORITHM_EXAMPLES[0] ??
      null,
  );
  const [previewLang, setPreviewLang] = useState<SupportedLanguage>(
    LANG_ORDER.includes(language) ? language : 'typescript',
  );

  const filtered =
    typeFilter === 'all'
      ? ALGORITHM_EXAMPLES
      : ALGORITHM_EXAMPLES.filter((e) => e.algorithmType === typeFilter);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl bg-slate-900 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] shrink-0">
          <h2 className="text-base font-bold text-white">Examples</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white transition-all cursor-pointer"
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

        {/* Type filter tabs */}
        <div className="flex items-center gap-1.5 px-6 py-3 border-b border-white/[0.07] shrink-0">
          {(['all', 0, 1, 2] as TypeFilter[]).map((f) => (
            <button
              key={String(f)}
              type="button"
              onClick={() => setTypeFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                typeFilter === f
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                  : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:bg-white/[0.08]'
              }`}
            >
              {f === 'all'
                ? `All (${ALGORITHM_EXAMPLES.length})`
                : `${TYPE_LABELS[f as number]} (${ALGORITHM_EXAMPLES.filter((e) => e.algorithmType === f).length})`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left: example list */}
          <div className="w-56 shrink-0 border-r border-white/[0.07] overflow-y-auto">
            <div className="p-2 flex flex-col gap-0.5">
              {filtered.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => setSelected(ex)}
                  className={`w-full text-left px-3 py-3 rounded-xl border transition-all cursor-pointer ${
                    selected?.id === ex.id
                      ? 'bg-blue-500/15 border-blue-500/40'
                      : 'bg-transparent border-transparent hover:bg-white/[0.05] hover:border-white/[0.06]'
                  }`}
                >
                  <div className="text-sm font-semibold text-white/90 leading-tight mb-1.5">
                    {ex.name}
                  </div>
                  <span
                    className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-gradient-to-r border ${TYPE_COLORS[ex.algorithmType]}`}
                  >
                    {TYPE_LABELS[ex.algorithmType]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: preview */}
          <div className="flex-1 flex flex-col min-w-0">
            {selected == null ? (
              <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
                Select an example
              </div>
            ) : (
              <>
                {/* Preview header */}
                <div className="px-5 pt-4 pb-3 border-b border-white/[0.07] shrink-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base font-bold text-white">{selected.name}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md bg-gradient-to-r border ${TYPE_COLORS[selected.algorithmType]}`}
                        >
                          {TYPE_LABELS[selected.algorithmType]}
                        </span>
                      </div>
                      <p className="text-sm text-white/50 leading-relaxed">
                        {selected.description}
                      </p>
                      {selected.indicators.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {selected.indicators.map((ind) => (
                            <span
                              key={ind}
                              className="text-xs font-mono px-2 py-0.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-300"
                            >
                              {ind}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Language tabs */}
                    <div className="flex items-center gap-1 shrink-0">
                      {LANG_ORDER.map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setPreviewLang(lang)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                            previewLang === lang
                              ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                              : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'
                          }`}
                        >
                          {LANG_LABELS[lang]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Code */}
                <div className="flex-1 overflow-y-auto bg-slate-950/50">
                  <pre className="p-5 text-sm font-mono text-white/80 leading-relaxed whitespace-pre-wrap break-words">
                    {selected.code[previewLang].trim()}
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/[0.07] shrink-0 bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selected == null}
            onClick={() => {
              if (selected) onCreateFromExample(selected, previewLang);
            }}
            className="px-4 py-2 rounded-xl text-sm border border-emerald-500/40 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-white hover:from-emerald-500/30 hover:to-teal-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Create Algorithm
          </button>
        </div>
      </div>
    </div>
  );
}
