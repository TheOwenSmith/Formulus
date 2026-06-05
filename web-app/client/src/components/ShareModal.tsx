import { trpcCredentials } from '@client/lib/trpc';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

function ProBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 text-amber-400 shrink-0">
      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      PRO
    </span>
  );
}

function Avatar({ name, image, size = 'sm' }: { name: string; image: string | null; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-9 h-9 text-sm' : 'w-7 h-7 text-xs';
  if (image) {
    return <img src={image} alt={name} className={`${cls} rounded-full object-cover shrink-0`} />;
  }
  return (
    <div
      className={`${cls} rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center font-semibold text-white/70 shrink-0`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function CopyIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-9 h-5 rounded-full border transition-all duration-200 cursor-pointer shrink-0 ${
        checked
          ? 'bg-emerald-500/30 border-emerald-500/60'
          : 'bg-white/5 border-white/15'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 shadow-sm ${
          checked ? 'left-4 bg-emerald-400' : 'left-0.5 bg-white/40'
        }`}
      />
    </button>
  );
}

export function ShareModal({
  publicId,
  isOwner,
  onClose,
}: {
  publicId: string;
  isOwner: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [emailInput, setEmailInput] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [allowCopy, setAllowCopy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { data: access } = useQuery(
    trpcCredentials.sharing.getResultAccess.queryOptions({ publicId }),
  );

  const { data: shares = [], isLoading: sharesLoading } = useQuery(
    trpcCredentials.sharing.getSharesForResult.queryOptions(
      { publicId },
      { enabled: isOwner },
    ),
  );

  const { data: foundUser, isFetching: searching } = useQuery(
    trpcCredentials.sharing.searchUser.queryOptions(
      { email: searchEmail },
      { enabled: searchEmail.length > 0 },
    ),
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: trpcCredentials.sharing.getSharesForResult.queryKey({ publicId }),
    });
    void queryClient.invalidateQueries({
      queryKey: trpcCredentials.sharing.getResultAccess.queryKey({ publicId }),
    });
  };

  const { mutate: shareResult, isPending: sharing } = useMutation(
    trpcCredentials.sharing.shareResult.mutationOptions({
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to share'),
      onSuccess: () => {
        toast.success('Result shared');
        setEmailInput('');
        setSearchEmail('');
        invalidate();
      },
    }),
  );

  const { mutate: updateShare } = useMutation(
    trpcCredentials.sharing.updateShare.mutationOptions({
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update share'),
      onSuccess: invalidate,
    }),
  );

  const { mutate: removeShare } = useMutation(
    trpcCredentials.sharing.removeShare.mutationOptions({
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to remove share'),
      onSuccess: invalidate,
    }),
  );

  const { mutate: setPublic } = useMutation(
    trpcCredentials.sharing.setPublic.mutationOptions({
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update visibility'),
      onSuccess: invalidate,
    }),
  );

  function handleSearch() {
    const trimmed = emailInput.trim().toLowerCase();
    if (trimmed) setSearchEmail(trimmed);
  }

  function handleShare() {
    if (foundUser == null) return;
    shareResult({ publicId, email: foundUser.email, allowCopy });
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/backtest/${publicId}`;
    void navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied to clipboard');
    });
  }

  const isPublic = access?.isPublic ?? false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.08)] bg-slate-900/95 backdrop-blur-[10px] border border-white/10 p-6 animate-[fadeInUp_0.2s_ease-out] flex flex-col gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-white leading-tight">Share Results</h2>
              <p className="text-xs text-white/40 mt-0.5">Control who can view and copy this backtest</p>
            </div>
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

        {/* Public toggle */}
        {isOwner && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-white/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-white/80">Public access</p>
                <p className="text-xs text-white/35 mt-0.5">
                  {isPublic ? 'Any logged-in user with the link can view' : 'Only people you share with can view'}
                </p>
              </div>
            </div>
            <Toggle
              checked={isPublic}
              onChange={(v) => setPublic({ publicId, isPublic: v })}
            />
          </div>
        )}

        {/* Copy link — shown when public */}
        {isPublic && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/35 font-mono truncate">
                {window.location.origin}/backtest/{publicId}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy link
            </button>
          </div>
        )}

        {/* Share with user */}
        {isOwner && (
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">
              Share with a user
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter email address"
                className="flex-1 rounded-xl bg-white/[0.06] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={!emailInput.trim()}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {searching ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  'Search'
                )}
              </button>
            </div>

            {/* Search result */}
            {searchEmail.length > 0 && !searching && (
              <div className="mt-3">
                {foundUser == null ? (
                  <p className="text-xs text-white/35 px-1">No user found with that email.</p>
                ) : (
                  <div className="rounded-xl bg-white/[0.04] border border-white/8 p-3 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={foundUser.name} image={foundUser.image} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-white/90 truncate">{foundUser.name}</p>
                          {foundUser.stripePlanActive && <ProBadge />}
                        </div>
                        <p className="text-xs text-white/40 truncate">{foundUser.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <Toggle checked={allowCopy} onChange={setAllowCopy} />
                        <span className="flex items-center gap-1.5 text-xs text-white/55">
                          <CopyIcon />
                          Allow algorithm copy
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={handleShare}
                        disabled={sharing}
                        className="px-4 py-2 rounded-xl text-sm font-medium border border-blue-500/40 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sharing ? 'Sharing…' : 'Share'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Existing shares */}
        {isOwner && (
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">
              Shared with
            </label>
            {sharesLoading ? (
              <p className="text-xs text-white/30 px-1">Loading…</p>
            ) : shares.length === 0 ? (
              <p className="text-xs text-white/30 px-1">Not shared with anyone yet.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-0.5">
                {shares.map((share) => (
                  <div
                    key={share.userId}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                  >
                    <Avatar name={share.userName} image={share.userImage} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm text-white/80 font-medium truncate">{share.userName}</p>
                        {share.userIsPro && <ProBadge />}
                      </div>
                      <p className="text-xs text-white/35 truncate">{share.userEmail}</p>
                    </div>
                    {share.dismissedByRecipient && (
                      <span className="text-xs text-white/25 shrink-0">dismissed</span>
                    )}
                    <label className="flex items-center gap-1.5 cursor-pointer shrink-0" title="Allow algorithm copy">
                      <Toggle
                        checked={share.allowCopy}
                        onChange={(v) =>
                          updateShare({ publicId, recipientUserId: share.userId, allowCopy: v })
                        }
                      />
                      <CopyIcon />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeShare({ publicId, recipientUserId: share.userId })}
                      className="text-white/25 hover:text-red-400 transition-colors cursor-pointer shrink-0"
                      title="Remove share"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Read-only: shared with you info */}
        {!isOwner && access != null && (
          <div className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center gap-3">
            <svg className="w-4 h-4 text-blue-400/70 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-white/55 leading-relaxed">
              {access.isPublic
                ? 'This result is public — anyone with the link can view it.'
                : access.canCopy
                ? 'Shared with you · you can view results and copy algorithms.'
                : 'Shared with you · you can view results only.'}
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium border border-white/20 bg-white/5 text-white/80 hover:bg-white/10 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
