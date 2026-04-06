import { ALGORITHM_EXAMPLES, type AlgorithmExample } from '@shared/examples';
import type { SupportedLanguage } from '@shared/worker';
import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  algorithmType: 0 | 1 | 2;
  language: SupportedLanguage;
  onLoad: (code: string) => void;
  onClose: () => void;
};

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

// ─── Component ────────────────────────────────────────────────────────────────

export function ExamplesModal({ algorithmType, language, onLoad, onClose }: Props) {
  const examples = ALGORITHM_EXAMPLES.filter((e) => e.algorithmType === algorithmType);

  const [selected, setSelected] = useState<AlgorithmExample | null>(examples[0] ?? null);
  const [previewLang, setPreviewLang] = useState<SupportedLanguage>(language);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleLoad() {
    if (selected == null) return;
    setConfirmOpen(true);
  }

  function handleConfirm() {
    if (selected == null) return;
    onLoad(selected.code[previewLang]);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl bg-slate-900 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">Examples</h2>
            <p className="text-xs text-white/40 mt-0.5">
              {TYPE_LABELS[algorithmType]} algorithm examples — click to preview, then load
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left: example list */}
          <div className="w-56 shrink-0 border-r border-white/[0.07] flex flex-col overflow-y-auto">
            {examples.length === 0 ? (
              <p className="text-xs text-white/40 p-4">No examples for this algorithm type.</p>
            ) : (
              <div className="p-2 flex flex-col gap-1">
                {examples.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => setSelected(ex)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
                      selected?.id === ex.id
                        ? 'bg-blue-500/15 border-blue-500/40 text-white'
                        : 'bg-white/[0.03] border-white/[0.06] text-white/70 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-semibold leading-tight">{ex.name}</div>
                    <div className="text-[10px] text-white/40 mt-0.5 leading-tight line-clamp-2">
                      {ex.description}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: code preview */}
          <div className="flex-1 flex flex-col min-w-0">
            {selected == null ? (
              <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
                Select an example
              </div>
            ) : (
              <>
                {/* Preview header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] shrink-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{selected.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md bg-gradient-to-r border ${TYPE_COLORS[selected.algorithmType]}`}>
                        {TYPE_LABELS[selected.algorithmType]}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 mt-0.5">{selected.description}</p>
                    {selected.indicators.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[10px] text-white/30">Uses:</span>
                        {selected.indicators.map((ind) => (
                          <span
                            key={ind}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-500/15 border border-violet-500/30 text-violet-300"
                          >
                            {ind}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Language selector */}
                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    {(Object.keys(LANG_LABELS) as SupportedLanguage[]).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setPreviewLang(lang)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-medium border transition-all cursor-pointer ${
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

                {/* Code */}
                <div className="flex-1 overflow-y-auto">
                  <pre className="p-4 text-xs font-mono text-white/80 leading-relaxed whitespace-pre-wrap break-words">
                    {selected.code[previewLang].trim()}
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.07] shrink-0">
          <p className="text-xs text-white/30">
            Loading an example replaces your current code.
          </p>
          <div className="flex items-center gap-2">
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
              onClick={handleLoad}
              className="px-4 py-2 rounded-xl text-sm border border-emerald-500/40 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-white hover:from-emerald-500/30 hover:to-teal-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Load Example
            </button>
          </div>
        </div>
      </div>

      {/* Confirm overwrite */}
      {confirmOpen && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setConfirmOpen(false)}
          />
          <div className="relative bg-slate-800 border border-white/15 rounded-2xl p-6 max-w-sm w-full shadow-xl mx-4">
            <h3 className="text-sm font-bold text-white mb-2">Replace current code?</h3>
            <p className="text-xs text-white/50 mb-5 leading-relaxed">
              This will replace your editor content with the <span className="text-white/80 font-medium">{selected?.name}</span> example in {LANG_LABELS[previewLang]}. Any unsaved changes will be lost.
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-3 py-1.5 rounded-lg text-sm border border-white/10 bg-white/5 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-3 py-1.5 rounded-lg text-sm border border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors cursor-pointer"
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
