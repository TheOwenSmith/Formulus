import { LoadingScreen } from '@client/components/LoadingScreen';
import { CAMERA_PATHS, CHART_BAR, SHARE } from '@client/icons/index';
import { signOut } from '@client/lib/auth-client';
import { trpcCredentials } from '@client/lib/trpc';
import { useUserStore } from '@client/stores/user-store';
import {
  BASIC_PLAN_MAX_ALGORITHMS_COUNT,
  BASIC_PLAN_MAX_BACKTESTS_PER_MONTH,
  BASIC_PLAN_MAX_CONCURRENT_BACKTESTS,
  PRO_PLAN_MAX_ALGORITHMS_COUNT,
  PRO_PLAN_MAX_BACKTESTS_PER_MONTH,
  PRO_PLAN_MAX_CONCURRENT_BACKTESTS,
} from '@shared/constants/limits';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

function ProBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 text-amber-400">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      PRO
    </span>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { setHasAccount } = useUserStore();
  const queryClient = useQueryClient();

  const { data: getUserApiResponse, isPending: userIsPending } = useQuery(
    trpcCredentials.users.getCurrentUser.queryOptions(),
  );

  const { data: profileStats, isPending: statsIsPending } = useQuery(
    trpcCredentials.users.getProfileStats.queryOptions(),
  );

  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteBacktests, setDeleteBacktests] = useState(false);

  useEffect(() => {
    if (getUserApiResponse != undefined) {
      const { user } = getUserApiResponse;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftName(user.name);
    }
  }, [getUserApiResponse]);

  // Name change mutation
  const { mutateAsync: nameChangeMutation, isPending: nameChangeIsPending } = useMutation(
    trpcCredentials.users.updateProfile.mutationOptions({
      onError: (error) => {
        console.error('Error updating name:', error);
        toast.error(
          error instanceof Error ? error.message : 'Failed to update name. Please try again.',
        );
        setDraftName(user?.name ?? '');
      },
      onSuccess: ({ updatedUser }) => {
        toast.success('Name updated successfully');
        setIsEditingName(false);
        queryClient.setQueryData(trpcCredentials.users.getCurrentUser.queryKey(), {
          user: updatedUser,
        });
        setDraftName(updatedUser.name);
      },
    }),
  );

  // Update profile picture mutation
  const { mutateAsync: updateProfilePictureMutation, isPending: profilePictureUpdateIsPending } =
    useMutation(
      trpcCredentials.users.updateProfile.mutationOptions({
        onError: (error) => {
          console.error('Error uploading image:', error);
          toast.error(
            error instanceof Error ? error.message : 'Failed to upload image. Please try again.',
          );
        },
        onSuccess: ({ updatedUser }) => {
          toast.success('Profile photo updated successfully');
          queryClient.setQueryData(trpcCredentials.users.getCurrentUser.queryKey(), {
            user: updatedUser,
          });
          setDraftName(updatedUser.name);
        },
      }),
    );

  // Delete account mutation
  const { mutateAsync: deleteAccountMutation, isPending: deleteAccountIsPending } = useMutation(
    trpcCredentials.users.deleteAccount.mutationOptions({
      onError: (error) => {
        console.error('Error deleting account:', error);
        toast.error(
          error instanceof Error ? error.message : 'Failed to delete account. Please try again.',
        );
        setShowDeleteConfirm(false);
      },
      onSuccess: async () => {
        await signOut();
        toast.success('Account successfully deleted');
        navigate('/login');
        setShowDeleteConfirm(false);
        setHasAccount(false);
      },
    }),
  );

  const handleDeleteAccountWithChoice = async (withDeleteBacktests: boolean) => {
    await deleteAccountMutation({ deleteBacktests: withDeleteBacktests });
  };

  const { mutateAsync: createCheckoutSession, isPending: checkoutIsPending } = useMutation(
    trpcCredentials.payments.createCheckoutSession.mutationOptions({
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : 'Failed to start checkout. Please try again.',
        );
      },
    }),
  );

  const { mutateAsync: createPortalSession, isPending: portalIsPending } = useMutation(
    trpcCredentials.payments.createPortalSession.mutationOptions({
      onError: (error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to open billing portal. Please try again.',
        );
      },
    }),
  );

  const handleUpgradeToPro = async () => {
    const profileUrl = `${window.location.origin}/profile`;
    const result = await createCheckoutSession({ successUrl: profileUrl, cancelUrl: profileUrl });
    if (result?.url) window.location.href = result.url;
  };

  const handleManageSubscription = async () => {
    const result = await createPortalSession({ returnUrl: `${window.location.origin}/profile` });
    if (result?.url) window.location.href = result.url;
  };

  // Sign out handler
  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out. Please try again.');
    }
  };

  // Name change handler
  const handleNameChange = async () => {
    if (!draftName.trim() || draftName.trim() === user?.name) {
      setIsEditingName(false);
      setDraftName(user?.name ?? '');
      return;
    }

    await nameChangeMutation({
      name: draftName.trim(),
    });
  };

  // Image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    // Convert to base64 for now (in production, upload to a service like S3)
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      await updateProfilePictureMutation({
        image: base64String,
      });
    };

    reader.onerror = () => {
      toast.error('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const formatDate = (dateString: string | Date | undefined) => {
    if (!dateString) return 'N/A';
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  // Render loading screen if user is not fetched yet
  if (userIsPending || getUserApiResponse == undefined) {
    return <LoadingScreen />;
  }
  const { user } = getUserApiResponse;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 pt-4 pb-8 font-sans text-white">
      <div className="max-w-[1000px] mx-auto">
        <div className="space-y-6 animate-[fadeInUp_0.8s_ease-out]">
          {/* Profile Header Card */}
          <div className="bg-slate-900/60 rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px]">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-6">
              <div className="relative group">
                {user.image ? (
                  <div className="relative">
                    <img
                      src={user.image}
                      alt={user.name}
                      className="w-24 h-24 rounded-full border-2 border-white/20 object-cover"
                    />
                    <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        {CAMERA_PATHS.map((path, index) => (
                          <path
                            key={index}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={path}
                          />
                        ))}
                      </svg>
                    </div>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-full border-2 border-white/20 bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center text-4xl font-bold relative group">
                    {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
                    <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        {CAMERA_PATHS.map((path, index) => (
                          <path
                            key={index}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={path}
                          />
                        ))}
                      </svg>
                    </div>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={profilePictureUpdateIsPending}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                {profilePictureUpdateIsPending && (
                  <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                    <svg
                      className="animate-spin h-6 w-6 text-white"
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
              <div className="flex-1 text-center md:text-left">
                <div className="h-[3rem] flex flex-col justify-start">
                  {isEditingName ? (
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-3 h-full">
                      <input
                        type="text"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleNameChange();
                          if (e.key === 'Escape') {
                            setIsEditingName(false);
                            setDraftName(user?.name ?? '');
                          }
                        }}
                        autoFocus
                        className="px-1 py-0 rounded bg-transparent border-b-2 border-blue-500/50 text-2xl font-bold text-white/70 focus:outline-none focus:border-blue-500 transition-all duration-300 disabled:opacity-50 min-w-0 h-[1.875rem]"
                        style={{
                          lineHeight: '1.5',
                        }}
                        disabled={nameChangeIsPending}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleNameChange}
                          disabled={nameChangeIsPending}
                          className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 text-white hover:from-blue-500/30 hover:to-cyan-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {nameChangeIsPending ? (
                            <svg
                              className="animate-spin h-4 w-4"
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
                          ) : (
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                          <span>Save</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsEditingName(false);
                            setDraftName(user?.name ?? '');
                          }}
                          disabled={nameChangeIsPending}
                          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row items-center gap-3 h-full">
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent leading-[1.875rem]">
                        {user?.name ?? 'User'}
                      </h2>
                      {user?.stripePlanActive && <ProBadge />}
                      <button
                        onClick={() => setIsEditingName(true)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300 text-sm flex items-center gap-1.5"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        <span>Edit</span>
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-white/70 mt-1">{user?.email ?? 'No email'}</p>
                <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-white/60">Account Created:</span>
                    <span className="text-white/90 font-medium">
                      {formatDate(user?.createdAt as string | Date | undefined)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/60">Email Verified:</span>
                    {user?.emailVerified ? (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Verified
                      </span>
                    ) : (
                      <span className="text-yellow-400 flex items-center gap-1.5">
                        <svg
                          className="w-4 h-4"
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
                        Not Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Usage Statistics Card */}
          <div className="bg-slate-900/60 rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px]">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              Usage Statistics
            </h2>
            {statsIsPending ? (
              <div className="flex items-center justify-center py-8">
                <svg
                  className="animate-spin h-8 w-8 text-blue-500"
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
            ) : (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-800/40 rounded-xl p-6 border border-white/5 hover:border-white/10 transition-all duration-300">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-blue-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={CHART_BAR}
                          />
                        </svg>
                      </div>
                      <h3 className="text-white/60 text-sm font-medium">Algorithms</h3>
                    </div>
                    <p className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                      {profileStats?.numberOfAlgorithms ?? 0}
                      <span className="text-base font-normal text-white/30 ml-0.5">
                        /{user?.stripePlanActive ? PRO_PLAN_MAX_ALGORITHMS_COUNT : BASIC_PLAN_MAX_ALGORITHMS_COUNT}
                      </span>
                    </p>
                  </div>

                  <div className="bg-slate-800/40 rounded-xl p-6 border border-white/5 hover:border-white/10 transition-all duration-300">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-purple-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={CHART_BAR}
                          />
                        </svg>
                      </div>
                      <h3 className="text-white/60 text-sm font-medium">Backtests Saved</h3>
                    </div>
                    <p className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      {profileStats?.numberOfBacktestingResults ?? 0}
                    </p>
                  </div>

                  <div className="bg-slate-800/40 rounded-xl p-6 border border-white/5 hover:border-white/10 transition-all duration-300">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-teal-500/30 flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-teal-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={CHART_BAR}
                          />
                        </svg>
                      </div>
                      <h3 className="text-white/60 text-sm font-medium">Backtests This Month</h3>
                    </div>
                    <p className="text-3xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                      {profileStats?.backtestsThisMonth ?? 0}
                      <span className="text-base font-normal text-white/30 ml-0.5">
                        /{user?.stripePlanActive ? PRO_PLAN_MAX_BACKTESTS_PER_MONTH : BASIC_PLAN_MAX_BACKTESTS_PER_MONTH}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-800/40 rounded-xl p-6 border border-white/5 hover:border-white/10 transition-all duration-300">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-emerald-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={SHARE}
                          />
                        </svg>
                      </div>
                      <h3 className="text-white/60 text-sm font-medium">Shared with Me</h3>
                    </div>
                    <p className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                      {profileStats?.numberOfBacktestingShares ?? 0}
                    </p>
                  </div>

                  <div className="bg-slate-800/40 rounded-xl p-6 border border-white/5 hover:border-white/10 transition-all duration-300">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30 flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-orange-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={SHARE}
                          />
                        </svg>
                      </div>
                      <h3 className="text-white/60 text-sm font-medium">Shared by Me</h3>
                    </div>
                    <p className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                      {profileStats?.numberOfBacktestingSharesSent ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pro Plan Card */}
          <div className="bg-slate-900/60 rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px]">
            <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">
              Pro Plan
            </h2>
            <p className="text-white/40 text-sm mb-6">$8.95 / month</p>

            {/* Plan comparison */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {/* Basic column */}
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-4">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Basic</p>
                <div className="flex flex-col gap-2.5">
                  {[
                    `${BASIC_PLAN_MAX_BACKTESTS_PER_MONTH} backtests / month`,
                    `${BASIC_PLAN_MAX_CONCURRENT_BACKTESTS} concurrent backtests`,
                    `${BASIC_PLAN_MAX_ALGORITHMS_COUNT} algorithms`,
                    'No Pro badge',
                    'Non-refundable',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 text-white/20 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="text-white/40 text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pro column */}
              <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border border-amber-500/30 p-4">
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">Pro</p>
                <div className="flex flex-col gap-2.5">
                  {[
                    `${PRO_PLAN_MAX_BACKTESTS_PER_MONTH} backtests / month`,
                    `${PRO_PLAN_MAX_CONCURRENT_BACKTESTS} concurrent backtests`,
                    `${PRO_PLAN_MAX_ALGORITHMS_COUNT} algorithms`,
                    'Pro badge on profile',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-white/80 text-sm">{item}</span>
                    </div>
                  ))}
                  <div className="flex items-start gap-2">
                    <svg className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-white/80 text-sm">
                      <a href="mailto:owensmith@uchicago.edu" className="underline underline-offset-2 hover:text-amber-400 transition-colors">Refundable</a> within billing period
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {user?.stripePlanActive ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-semibold">You are a Pro member</p>
                    <p className="text-white/50 text-sm">Thank you for your support!</p>
                  </div>
                </div>
                <button
                  onClick={() => void handleManageSubscription()}
                  disabled={portalIsPending}
                  className="w-full px-6 py-4 rounded-xl font-medium text-base cursor-pointer transition-all duration-300 flex items-center justify-center gap-3 shadow-lg border hover:-translate-y-0.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border-amber-500/30 hover:border-amber-500/50 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {portalIsPending ? (
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                  <span>Manage Subscription</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => void handleUpgradeToPro()}
                disabled={checkoutIsPending}
                className="w-full px-6 py-4 rounded-xl font-medium text-base cursor-pointer transition-all duration-300 flex items-center justify-center gap-3 shadow-lg border hover:-translate-y-0.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border-amber-500/30 hover:border-amber-500/50 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkoutIsPending ? (
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                )}
                <span>Upgrade to Pro — $8.95/month</span>
              </button>
            )}
          </div>

          {/* Account Actions Card */}
          <div className="bg-slate-900/60 rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px]">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              Account Actions
            </h2>
            <div className="space-y-4">
              <button
                onClick={handleSignOut}
                className="w-full px-6 py-4 rounded-xl font-medium text-base cursor-pointer transition-all duration-300 flex items-center justify-center gap-3 shadow-lg border hover:-translate-y-0.5 bg-gradient-to-r from-red-500/20 to-orange-500/20 hover:from-red-500/30 hover:to-orange-500/30 border-red-500/30 hover:border-red-500/50 text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span>Sign Out</span>
              </button>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => {
                    setShowDeleteConfirm(true);
                    setDeleteBacktests(false);
                  }}
                  className="w-full px-6 py-4 rounded-xl font-medium text-base cursor-pointer transition-all duration-300 flex items-center justify-center gap-3 shadow-lg border hover:-translate-y-0.5 bg-gradient-to-r from-red-500/20 to-rose-500/20 hover:from-red-500/30 hover:to-rose-500/30 border-red-500/30 hover:border-red-500/50 text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  <span>Delete Account</span>
                </button>
              ) : (
                <div className="p-5 rounded-xl bg-red-500/10 border border-red-500/30 space-y-4">
                  <p className="text-red-400 font-medium">
                    Are you sure you want to delete your account? This action cannot be undone.
                  </p>

                  <div className="space-y-2">
                    <p className="text-white/60 text-sm font-medium">
                      What should happen to your backtesting results?
                    </p>
                    <label className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all duration-200">
                      <input
                        type="radio"
                        name="deleteBacktests"
                        checked={!deleteBacktests}
                        onChange={() => setDeleteBacktests(false)}
                        className="mt-0.5 accent-blue-500"
                        disabled={deleteAccountIsPending}
                      />
                      <div>
                        <p className="text-white/90 text-sm font-medium">Keep my backtests</p>
                        <p className="text-white/50 text-xs mt-0.5">
                          Results remain accessible via their links, but will no longer have an
                          owner. You will have no control over them once your account is deleted.
                        </p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all duration-200">
                      <input
                        type="radio"
                        name="deleteBacktests"
                        checked={deleteBacktests}
                        onChange={() => setDeleteBacktests(true)}
                        className="mt-0.5 accent-red-500"
                        disabled={deleteAccountIsPending}
                      />
                      <div>
                        <p className="text-white/90 text-sm font-medium">Delete all my backtests</p>
                        <p className="text-white/50 text-xs mt-0.5">
                          All results, graphs, and shared data are permanently removed.
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleDeleteAccountWithChoice(deleteBacktests)}
                      disabled={deleteAccountIsPending}
                      className="flex-1 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {deleteAccountIsPending ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg
                            className="animate-spin h-4 w-4"
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
                          Deleting...
                        </span>
                      ) : (
                        'Confirm Delete'
                      )}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleteAccountIsPending}
                      className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
