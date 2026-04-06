import { ShareModal } from '@client/components/ShareModal';
import { trpcCredentials } from '@client/lib/trpc';
import { useSharedNotificationsStore } from '@client/store/sharedNotificationsStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className="w-6 h-6 rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center text-[10px] font-semibold text-white/70 shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function SpinIcon() {
  return (
    <svg className="animate-spin h-8 w-8 text-white/30" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

type SharedEntry = {
  publicId: string;
  name: string | null;
  isPublic: boolean;
  algorithmNames: string[];
  creatorName: string;
  creatorImage: string | null;
  allowCopy: boolean;
  sharedAt: Date | string;
};

function SharedCard({
  entry,
  onView,
  onDismiss,
}: {
  entry: SharedEntry;
  onView: () => void;
  onDismiss: () => void;
}) {
  const displayName =
    entry.name ??
    (() => {
      const base = entry.algorithmNames.slice(0, 2).join(', ');
      const suffix = entry.algorithmNames.length > 2 ? ` +${entry.algorithmNames.length - 2}` : '';
      return `${base}${suffix}`;
    })();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onView}
      onKeyDown={(e) => e.key === 'Enter' && onView()}
      className="bg-slate-900/60 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-[0_24px_70px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.1)] hover:-translate-y-0.5 group"
    >
      {/* Top accent */}
      <div className="h-0.5 w-full bg-gradient-to-r from-blue-500/60 to-purple-500/60" />

      <div className="p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2 min-w-0 flex-1">
            <p className="text-base font-semibold text-white/90 truncate leading-snug">{displayName}</p>
            {/* Algorithm chips */}
            <div className="flex flex-wrap gap-1.5">
              {entry.algorithmNames.slice(0, 6).map((name) => (
                <span
                  key={name}
                  className="text-xs px-2 py-0.5 rounded-md bg-white/5 border border-white/8 text-white/45 truncate max-w-[180px]"
                >
                  {name}
                </span>
              ))}
              {entry.algorithmNames.length > 6 && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-white/5 border border-white/8 text-white/30">
                  +{entry.algorithmNames.length - 6}
                </span>
              )}
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {entry.isPublic && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/35 font-medium">
                Public
              </span>
            )}
            {entry.allowCopy && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-400/80 font-medium">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Can copy
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-white/35">
          <div className="flex items-center gap-2">
            <Avatar name={entry.creatorName} image={entry.creatorImage} />
            <span>
              Shared by <span className="text-white/55 font-medium">{entry.creatorName}</span>
            </span>
            <span className="text-white/20">·</span>
            <span>{timeAgo(entry.sharedAt)}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="flex items-center gap-1 text-white/25 hover:text-red-400/80 transition-colors font-medium cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Dismiss
            </button>
            <span className="flex items-center gap-1 text-blue-400/55 group-hover:text-blue-300 transition-colors font-medium">
              View results
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Result picker modal ──────────────────────────────────────────────────────

function ResultPickerModal({
  onPick,
  onClose,
}: {
  onPick: (publicId: string) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState('');

  const { data: submissions = [], isLoading } = useQuery(
    trpcCredentials.backtesting.getSubmissions.queryOptions(),
  );

  const finished = (submissions as Array<{
    publicId: string;
    name: string | null;
    status: string;
    createdAt: string;
    algorithmNames: string[];
  }>).filter((s) => s.status === 'FINISHED');

  const filtered = filter.trim()
    ? finished.filter((s) => {
        const q = filter.toLowerCase();
        const displayName = s.name ?? s.algorithmNames.join(' ');
        return displayName.toLowerCase().includes(q);
      })
    : finished;

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.08)] bg-slate-900/95 backdrop-blur-[10px] border border-white/10 p-6 animate-[fadeInUp_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-white">Share a result</h2>
            <p className="text-xs text-white/40 mt-0.5">Pick a finished backtest to share</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/30 hover:text-white/70 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name…"
            autoFocus
            className="w-full rounded-xl bg-white/[0.06] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
          />
        </div>

        {/* List */}
        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-0.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <svg className="animate-spin w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-white/30 py-10">
              {finished.length === 0 ? 'No finished backtests yet.' : 'No results match your filter.'}
            </p>
          ) : (
            filtered.map((s) => {
              const displayName =
                s.name ??
                (() => {
                  const base = s.algorithmNames.slice(0, 2).join(', ');
                  const suffix = s.algorithmNames.length > 2 ? ` +${s.algorithmNames.length - 2}` : '';
                  return `${base}${suffix}`;
                })();
              return (
                <button
                  key={s.publicId}
                  type="button"
                  onClick={() => onPick(s.publicId)}
                  className="text-left px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] hover:border-white/15 transition-all duration-150 cursor-pointer group"
                >
                  <p className="text-sm font-medium text-white/80 group-hover:text-white truncate transition-colors">
                    {displayName}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {s.algorithmNames.slice(0, 4).map((name) => (
                      <span
                        key={name}
                        className="text-xs px-1.5 py-0.5 rounded-md bg-white/5 border border-white/8 text-white/35 truncate max-w-[140px]"
                      >
                        {name}
                      </span>
                    ))}
                    {s.algorithmNames.length > 4 && (
                      <span className="text-xs text-white/25">+{s.algorithmNames.length - 4}</span>
                    )}
                    <span className="ml-auto text-xs text-white/25 shrink-0">{timeAgo(s.createdAt)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const HEADER_OFFSET = '4rem';

export function SharedPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const markAsViewed = useSharedNotificationsStore((s) => s.markAsViewed);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sharePublicId, setSharePublicId] = useState<string | null>(null);

  // Mark all shared items as seen when the page loads
  useEffect(() => {
    markAsViewed();
  }, [markAsViewed]);

  const { data: entries = [], isLoading } = useQuery(
    trpcCredentials.sharing.getSharedWithMe.queryOptions(),
  );

  const { mutate: dismissShare } = useMutation(
    trpcCredentials.sharing.dismissShare.mutationOptions({
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to dismiss'),
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpcCredentials.sharing.getSharedWithMe.queryKey(),
        });
      },
    }),
  );

  const list = entries as SharedEntry[];

  return (
    <>
    <div
      className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 font-sans text-white overflow-hidden flex flex-col"
      style={{ bottom: 0, left: 0, position: 'fixed', right: 0, top: HEADER_OFFSET }}
    >
      <div
        className="w-full mx-auto px-8 pt-8 pb-12 flex-1 min-h-0 overflow-y-auto"
        style={{ maxWidth: '760px' }}
      >
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h1
                className="text-3xl font-bold bg-clip-text text-transparent inline-block py-1"
                style={{
                  backgroundImage: 'linear-gradient(to right, #60a5fa, #a78bfa, #f472b6)',
                }}
              >
                Shared With Me
              </h1>
              {list.length > 0 && (
                <p className="text-white/40 text-sm mt-1 leading-normal pb-0.5">
                  {list.length} result{list.length !== 1 ? 's' : ''} shared with you
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-blue-500/30 bg-gradient-to-r from-blue-500/15 to-purple-500/15 hover:from-blue-500/25 hover:to-purple-500/25 hover:border-blue-500/50 text-white/70 hover:text-white transition-all duration-200 cursor-pointer shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              Share a result
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <SpinIcon />
          </div>
        ) : list.length === 0 ? (
          <div className="bg-slate-900/60 rounded-2xl p-20 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] flex flex-col items-center gap-4 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/15 to-purple-500/15 border border-blue-500/25 flex items-center justify-center mb-2">
              <svg
                className="w-10 h-10 text-blue-400/70"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">Nothing shared yet</h2>
            <p className="text-white/40 max-w-sm text-sm leading-relaxed">
              When someone shares a backtest result with you, it will appear here.
            </p>
            <p className="text-white/25 text-xs mt-1 max-w-xs leading-relaxed">
              To share your own results, open a finished backtest and click the{' '}
              <span className="text-white/40">Share</span> button.
            </p>
            <button
              onClick={() => navigate('/backtests')}
              className="mt-3 px-6 py-3 rounded-xl font-medium text-sm cursor-pointer transition-all duration-300 border hover:-translate-y-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 border-blue-500/30 hover:border-blue-500/50 text-white"
            >
              Go to My Backtests
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 animate-[fadeInUp_0.5s_ease-out]">
            {list.map((entry) => (
              <SharedCard
                key={entry.publicId}
                entry={entry}
                onView={() => navigate(`/backtest/${entry.publicId}`)}
                onDismiss={() => dismissShare({ publicId: entry.publicId })}
              />
            ))}
          </div>
        )}
      </div>
    </div>

    {pickerOpen && (
      <ResultPickerModal
        onPick={(publicId) => {
          setPickerOpen(false);
          setSharePublicId(publicId);
        }}
        onClose={() => setPickerOpen(false)}
      />
    )}
    {sharePublicId != null && (
      <ShareModal
        publicId={sharePublicId}
        isOwner
        onClose={() => setSharePublicId(null)}
      />
    )}
    </>
  );
}
