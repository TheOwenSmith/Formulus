import { AlgorithmResultCard } from '@client/components/AlgorithmResultCard';
import { ShareModal } from '@client/components/ShareModal';
import { PLUS, SIDE_BY_SIDE_RECTS, SINGLE_COLUMN, SVG_NAMESPACE } from '@client/icons/index';
import { trpcCredentials } from '@client/lib/trpc';
import '@client/styles/BacktestPage.css';
import { calculateTargetPosition } from '@client/utils/gridLayoutUtils';
import { throttle } from '@client/utils/throttle';
import type { BacktestAlgorithmsResult, Ticker, Timestamp } from '@shared/worker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useLoaderData } from 'react-router-dom';
import { toast } from 'sonner';

// Color schemes for drag preview and drop indicators (matching AlgorithmResultCard)
const colorSchemes = [
  {
    bgGradient: 'from-blue-950/20',
    bgGradientTo: 'to-cyan-950/20',
    borderColor: 'border-blue-500/30',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-cyan-300',
    primaryColor: '#3b82f6',
    primaryColorLight: '#60a5fa',
  },
  {
    bgGradient: 'from-emerald-950/20',
    bgGradientTo: 'to-teal-950/20',
    borderColor: 'border-emerald-500/30',
    gradientFrom: 'from-emerald-500',
    gradientTo: 'to-teal-300',
    primaryColor: '#10b981',
    primaryColorLight: '#34d399',
  },
  {
    bgGradient: 'from-purple-950/20',
    bgGradientTo: 'to-pink-950/20',
    borderColor: 'border-purple-500/30',
    gradientFrom: 'from-purple-600',
    gradientTo: 'to-pink-300',
    primaryColor: '#a855f7',
    primaryColorLight: '#c084fc',
  },
  {
    bgGradient: 'from-orange-950/20',
    bgGradientTo: 'to-red-950/20',
    borderColor: 'border-orange-500/30',
    gradientFrom: 'from-orange-500',
    gradientTo: 'to-red-600',
    primaryColor: '#f97316',
    primaryColorLight: '#fb923c',
  },
  {
    bgGradient: 'from-indigo-950/20',
    bgGradientTo: 'to-violet-950/20',
    borderColor: 'border-indigo-500/30',
    gradientFrom: 'from-indigo-600',
    gradientTo: 'to-violet-300',
    primaryColor: '#6366f1',
    primaryColorLight: '#818cf8',
  },
  {
    bgGradient: 'from-yellow-950/20',
    bgGradientTo: 'to-amber-950/20',
    borderColor: 'border-yellow-500/30',
    gradientFrom: 'from-yellow-500',
    gradientTo: 'to-amber-300',
    primaryColor: '#eab308',
    primaryColorLight: '#facc15',
  },
  {
    bgGradient: 'from-rose-950/20',
    bgGradientTo: 'to-fuchsia-950/20',
    borderColor: 'border-rose-500/30',
    gradientFrom: 'from-rose-600',
    gradientTo: 'to-fuchsia-300',
    primaryColor: '#f43f5e',
    primaryColorLight: '#fb7185',
  },
  {
    bgGradient: 'from-sky-950/20',
    bgGradientTo: 'to-blue-950/20',
    borderColor: 'border-sky-500/30',
    gradientFrom: 'from-sky-500',
    gradientTo: 'to-blue-300',
    primaryColor: '#0ea5e9',
    primaryColorLight: '#38bdf8',
  },
];

interface DragPreviewProps {
  algorithmName: string;
  colorIndex: number;
}

function DragPreview({ algorithmName, colorIndex }: DragPreviewProps) {
  const colorScheme = colorSchemes[colorIndex % colorSchemes.length];

  return (
    <div
      className={`bg-gradient-to-br ${colorScheme.bgGradient} ${colorScheme.bgGradientTo} rounded-xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.1)] backdrop-blur-[10px] border ${colorScheme.borderColor} w-64 opacity-95 rotate-2`}
    >
      <div className="relative z-10">
        <h3
          className={`text-lg font-bold mb-1 bg-gradient-to-r ${colorScheme.gradientFrom} ${colorScheme.gradientTo} bg-clip-text text-transparent`}
        >
          {algorithmName}
        </h3>
        <div className="text-xs text-white/60">Moving algorithm...</div>
      </div>
    </div>
  );
}

type AlgorithmVersionSnapshot = {
  id: string;
  name: string;
  type: string;
  aggregate: string;
  language: string;
  tickers: string[];
  k: number | null;
  contextLength: number;
  indicators: string[];
  algorithmMaxHoldingProportion: number | null;
  userAlgorithmImplementationCode: string;
  algorithmId: string;
};

function CopyAlgorithmModal({
  version,
  resultPublicId,
  onClose,
}: {
  version: AlgorithmVersionSnapshot;
  resultPublicId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [copyName, setCopyName] = useState(() => `Copy of ${version.name}`.slice(0, 64));

  const { mutateAsync: copyAlgorithmVersion, isPending } = useMutation(
    trpcCredentials.algorithms.copyAlgorithmVersion.mutationOptions({
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to copy algorithm');
      },
    }),
  );

  async function handleCopy() {
    const trimmed = copyName.trim();
    if (!trimmed) return;
    await copyAlgorithmVersion({
      name: trimmed,
      resultPublicId,
      versionId: version.id,
    });
    await queryClient.invalidateQueries({ queryKey: trpcCredentials.algorithms.getAlgorithms.queryKey() });
    toast.success('Algorithm copied to your library');
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.08)] bg-slate-900/95 backdrop-blur-[10px] border border-white/10 p-6 animate-[fadeInUp_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white mb-1">Copy algorithm version?</h2>
        <p className="text-white/50 text-sm mb-5">
          This will add a copy of{' '}
          <span className="text-white/80 font-medium">&quot;{version.name}&quot;</span> to your
          algorithms at the exact state it was in when this backtest was run.
        </p>
        <div className="mb-5">
          <label className="block text-xs text-white/40 uppercase tracking-wider mb-1.5">
            Algorithm Name
          </label>
          <input
            type="text"
            value={copyName}
            maxLength={64}
            onChange={(e) => setCopyName(e.target.value)}
            className="w-full rounded-xl bg-white/[0.06] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
          />
        </div>
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
            onClick={() => void handleCopy()}
            disabled={isPending || !copyName.trim()}
            className="px-4 py-2.5 rounded-xl text-sm font-medium border border-blue-500/40 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Copying…' : 'Copy to My Algorithms'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BacktestPage() {
  const { data, publicId } = useLoaderData<{ data: BacktestAlgorithmsResult & { name: string | null }; publicId: string }>();
  const name = data.name;
  const { data: algorithmVersions } = useQuery(
    trpcCredentials.backtesting.getAlgorithmVersionsForResult.queryOptions({ publicId }),
  );
  const versionByName = useMemo(() => {
    const map = new Map<string, AlgorithmVersionSnapshot>();
    for (const v of algorithmVersions ?? []) map.set(v.name, v);
    return map;
  }, [algorithmVersions]);
  const [copyModalVersion, setCopyModalVersion] = useState<AlgorithmVersionSnapshot | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const { data: access } = useQuery(
    trpcCredentials.sharing.getResultAccess.queryOptions({ publicId }),
  );

  // Get default ticker by aggregate
  const defaultTickerByAggregate = useMemo<Record<Timestamp, Ticker>>(() => {
    const result = {} as Record<Timestamp, Ticker>;
    for (const aggregate in data.tickerPlotByAggregateByTicker) {
      result[aggregate as Timestamp] = Object.keys(
        data.tickerPlotByAggregateByTicker[aggregate as Timestamp],
      )[0] as Ticker;
    }
    return result;
  }, [data]);

  // State for reordered algorithm names
  const [orderedAlgorithmNames, setOrderedAlgorithmNames] = useState<string[]>(() =>
    data.algorithmGraphs.map((algorithmGraph) => algorithmGraph.algorithmPlot.name),
  );

  // Side-by-side comparison mode state
  const [isSideBySideMode, setIsSideBySideMode] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  // Memoize the toggle handler to prevent unnecessary re-renders
  const handleToggleSideBySide = useCallback(() => {
    startTransition(() => {
      setIsSideBySideMode((prev) => !prev);
    });
  }, []);

  // Drag and drop state
  const [draggedAlgorithm, setDraggedAlgorithm] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<number | null>(null);
  const [dragPreviewPos, setDragPreviewPos] = useState<{ x: number; y: number } | null>(null);
  // For side-by-side mode: track which algorithm card is being hovered as drop target
  const [targetAlgorithmCard, setTargetAlgorithmCard] = useState<string | null>(null);
  // Track which algorithms were shifted for animation, with their shift direction
  const [shiftedAlgorithms, setShiftedAlgorithms] = useState<Map<string, 'left' | 'right'>>(
    new Map(),
  );

  // Map algorithm names to their original indices for color schemes
  const originalIndexByAlgorithmName = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < data.algorithmGraphs.length; i++) {
      map.set(data.algorithmGraphs[i].algorithmPlot.name, i);
    }
    return map;
  }, [data]);

  // Handle drag start
  const handleDragStart = useCallback((algorithmName: string) => {
    setDraggedAlgorithm(algorithmName);
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    const currentDragged = draggedAlgorithm;
    const currentTarget = targetAlgorithmCard;
    const currentDropPosition = dropPosition;
    const currentSideBySide = isSideBySideMode;

    if (currentDragged !== null) {
      // Preserve scroll position to prevent unwanted scrolling when reordering
      // This is especially important when moving algorithms up in side-by-side mode
      const scrollPosition = window.pageYOffset || document.documentElement.scrollTop || 0;
      const originalScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      if (document.body) {
        document.body.style.scrollBehavior = 'auto';
      }

      // Use startTransition to mark reordering as non-urgent, preventing unmount errors
      startTransition(() => {
        // Use functional update to avoid stale closure issues
        setOrderedAlgorithmNames((prevOrder) => {
          const currentIndex = prevOrder.indexOf(currentDragged);
          if (currentIndex === -1) return prevOrder;

          if (currentSideBySide && currentTarget) {
            // Side-by-side mode: replace target algorithm's position
            const targetIndex = prevOrder.indexOf(currentTarget);
            if (targetIndex === -1 || targetIndex === currentIndex) return prevOrder;

            const newOrder = [...prevOrder];
            const shiftedMap = new Map<string, 'left' | 'right'>();

            // Example: A(0), B(1), C(2), D(3) -> drag A onto C -> B(0), C(1), A(2), D(3)
            // The dragged algorithm takes the target's position
            // The target algorithm and everything between them shifts toward the dragged algorithm's original position

            if (currentIndex < targetIndex) {
              // Moving right: A(0) -> B(1) should result in B(0), A(1), C(2), D(3)
              // The dragged algorithm takes the target's position
              // The target and everything between shifts left

              // Track which algorithms will shift left (including the target)
              for (let i = currentIndex + 1; i <= targetIndex; i++) {
                shiftedMap.set(prevOrder[i], 'left');
              }

              // Remove dragged algorithm first
              newOrder.splice(currentIndex, 1);
              // After removal: [B, C, D] (B is at 0, C is at 1, D is at 2)
              // targetIndex was 1 (B's original position)
              // After removal, B is at 0, C is at 1
              // We want to insert the dragged algorithm at B's ORIGINAL position (1)
              // But after removal, position 1 is where C is
              // So we insert at targetIndex (the original position, which still exists after removal)
              newOrder.splice(targetIndex, 0, currentDragged);
              // Result: [B(0), A(1), C(2), D(3)] ✓
              // Target (B) is already at the correct position (currentIndex = 0) after removal
              // No need to insert it again - it's already where it should be
            } else {
              // Moving left: C(2) -> A(0) should result in C(0), A(1), B(2), D(3)
              // Track which algorithms will shift right (including the target)
              for (let i = targetIndex; i < currentIndex; i++) {
                shiftedMap.set(prevOrder[i], 'right');
              }

              // Remove dragged algorithm first: [A, B, D] (indices 0, 1, 2)
              newOrder.splice(currentIndex, 1);
              // After removal: [A, B, D], A is at 0, B is at 1
              // targetIndex is 0, we want to insert C at 0
              newOrder.splice(targetIndex, 0, currentDragged);
              // After insertion: [C(0), A(1), B(2), D(3)] ✓
              // Target (A) is now at 1, which is correct
              // No need to insert A again - it's already where it should be
            }

            // Trigger animation for shifted algorithms
            setShiftedAlgorithms(shiftedMap);
            // Clear animation after it completes
            setTimeout(() => {
              setShiftedAlgorithms(new Map());
            }, 500); // Match animation duration

            return newOrder;
          } else if (currentDropPosition !== null) {
            // Normal mode: insert at drop position
            const targetPosition = calculateTargetPosition(
              currentIndex,
              currentDropPosition,
              prevOrder.length,
            );

            // Only reorder if position actually changed
            if (currentIndex !== targetPosition) {
              const newOrder = [...prevOrder];
              const shiftedMap = new Map<string, 'left' | 'right'>();

              // Track which algorithms will shift
              if (currentIndex < targetPosition) {
                // Moving right: algorithms between current and target shift left
                for (let i = currentIndex + 1; i <= targetPosition; i++) {
                  shiftedMap.set(prevOrder[i], 'left');
                }
              } else {
                // Moving left: algorithms between target and current shift right
                for (let i = targetPosition; i < currentIndex; i++) {
                  shiftedMap.set(prevOrder[i], 'right');
                }
              }

              newOrder.splice(currentIndex, 1);
              newOrder.splice(targetPosition, 0, currentDragged);

              // Trigger animation for shifted algorithms
              setShiftedAlgorithms(shiftedMap);
              // Clear animation after it completes
              setTimeout(() => {
                setShiftedAlgorithms(new Map());
              }, 500); // Match animation duration

              return newOrder;
            }
          }
          return prevOrder;
        });
      });

      // Restore scroll position after a brief delay to allow React to render
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollPosition);
          document.documentElement.style.scrollBehavior = originalScrollBehavior;
          if (document.body) {
            document.body.style.scrollBehavior = '';
          }
        });
      });
    }
    // Batch state updates to prevent React errors
    setDraggedAlgorithm(null);
    setDropPosition(null);
    setDragPreviewPos(null);
    setTargetAlgorithmCard(null);
  }, [draggedAlgorithm, dropPosition, targetAlgorithmCard, isSideBySideMode]);

  // Global mouse up handler to end drag and cursor management
  useEffect(() => {
    if (draggedAlgorithm !== null) {
      // Set cursor to grabbing on body
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      // Disable pointer events on all elements except drag-related ones
      document.body.classList.add('dragging-active');

      const handleGlobalMouseUp = () => {
        handleDragEnd();
      };
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mouseup', handleGlobalMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.body.classList.remove('dragging-active');
      };
    }
    return undefined;
  }, [draggedAlgorithm, handleDragEnd]);

  // Handle drop zone hover
  const handleDropZoneHover = useCallback(
    (position: number) => {
      if (draggedAlgorithm !== null) {
        setDropPosition(position);
      }
    },
    [draggedAlgorithm],
  );

  // Auto-scroll during drag
  useEffect(() => {
    if (draggedAlgorithm === null) return undefined;

    const SCROLL_BUFFER = 170;
    const MAX_SCROLL_SPEED = 40;
    const MIN_SCROLL_SPEED = 2.5;

    let mouseY = 0;
    let animationFrameId: number | null = null;
    let isActive = true;

    const calculateScrollSpeed = (distanceFromEdge: number): number => {
      const normalizedDistance = Math.max(0, Math.min(1, distanceFromEdge / SCROLL_BUFFER));
      const speedFactor = Math.pow(1 - normalizedDistance, 3);
      return MIN_SCROLL_SPEED + (MAX_SCROLL_SPEED - MIN_SCROLL_SPEED) * speedFactor;
    };

    const animate = () => {
      if (!isActive) return;

      const viewportHeight = window.innerHeight;
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const scrollHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
      );
      const maxScroll = scrollHeight - viewportHeight;

      if (mouseY < SCROLL_BUFFER && scrollTop > 0) {
        const scrollSpeed = calculateScrollSpeed(mouseY);
        window.scrollTo(0, Math.max(0, scrollTop - scrollSpeed));
      } else if (mouseY > viewportHeight - SCROLL_BUFFER && scrollTop < maxScroll) {
        const scrollSpeed = calculateScrollSpeed(viewportHeight - mouseY);
        window.scrollTo(0, Math.min(maxScroll, scrollTop + scrollSpeed));
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    const originalScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    if (document.body) {
      document.body.style.scrollBehavior = 'auto';
    }

    animationFrameId = requestAnimationFrame(animate);

    // Cache DOM queries to avoid repeated lookups
    let cachedCards: NodeListOf<Element> | null = null;
    let cachedDropZones: NodeListOf<Element> | null = null;

    const handleMouseMove = throttle((e: MouseEvent) => {
      mouseY = e.clientY;
      setDragPreviewPos({ x: e.clientX + 20, y: e.clientY + 20 });

      if (isSideBySideMode) {
        // Side-by-side mode: detect algorithm cards as drop targets
        // First try elementsFromPoint
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        let foundTarget: string | null = null;

        for (const el of elements) {
          // Check if the element itself has the attribute
          if (el.hasAttribute?.('data-algorithm-card')) {
            const algorithmName = el.getAttribute('data-algorithm-card');
            if (algorithmName && algorithmName !== draggedAlgorithm) {
              foundTarget = algorithmName;
              break;
            }
          }
          // Also check parent elements
          const algorithmCard = el.closest('[data-algorithm-card]');
          if (algorithmCard) {
            const algorithmName = algorithmCard.getAttribute('data-algorithm-card');
            if (algorithmName && algorithmName !== draggedAlgorithm) {
              foundTarget = algorithmName;
              break;
            }
          }
        }

        // Fallback: check all algorithm cards and see which one the mouse is over
        if (!foundTarget) {
          cachedCards ??= document.querySelectorAll('[data-algorithm-card]');
          for (const card of cachedCards) {
            const rect = card.getBoundingClientRect();
            if (
              e.clientX >= rect.left &&
              e.clientX <= rect.right &&
              e.clientY >= rect.top &&
              e.clientY <= rect.bottom
            ) {
              const algorithmName = card.getAttribute('data-algorithm-card');
              if (algorithmName && algorithmName !== draggedAlgorithm) {
                foundTarget = algorithmName;
                break;
              }
            }
          }
        }

        if (foundTarget) {
          setTargetAlgorithmCard(foundTarget);
          setDropPosition(null); // Clear drop position in side-by-side mode
        } else {
          setTargetAlgorithmCard(null);
        }
      } else {
        // Normal mode: find drop zone by checking all drop zones and their bounding boxes
        cachedDropZones ??= document.querySelectorAll('[data-drop-zone]');
        let foundPosition: number | null = null;

        for (const dropZone of cachedDropZones) {
          const rect = dropZone.getBoundingClientRect();
          // Check if mouse is within the drop zone area (with generous padding for easier targeting)
          // Use larger padding to account for absolute positioning and grid layout
          const padding = 20;
          if (
            e.clientX >= rect.left - padding &&
            e.clientX <= rect.right + padding &&
            e.clientY >= rect.top - padding &&
            e.clientY <= rect.bottom + padding
          ) {
            const position = parseInt(dropZone.getAttribute('data-drop-zone') ?? '-1', 10);
            if (position >= 0) {
              foundPosition = position;
              break;
            }
          }
        }

        if (foundPosition !== null) {
          setDropPosition(foundPosition);
          setTargetAlgorithmCard(null); // Clear target card in normal mode
        } else {
          // Also try elementsFromPoint as fallback
          const elements = document.elementsFromPoint(e.clientX, e.clientY);
          for (const el of elements) {
            const dropZone = el.closest('[data-drop-zone]');
            if (dropZone) {
              const position = parseInt(dropZone.getAttribute('data-drop-zone') ?? '-1', 10);
              if (position >= 0) {
                setDropPosition(position);
                setTargetAlgorithmCard(null);
                return;
              }
            }
          }
          // Clear drop position if not over any drop zone
          setDropPosition(null);
          setTargetAlgorithmCard(null);
        }
      }
    }, 16); // ~60fps throttling

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      isActive = false;
      window.removeEventListener('mousemove', handleMouseMove);
      setDragPreviewPos(null);
      document.documentElement.style.scrollBehavior = originalScrollBehavior;
      if (document.body) {
        document.body.style.scrollBehavior = '';
      }
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [draggedAlgorithm, isSideBySideMode]);

  // Interactive gradient based on global cursor position
  const headerRef = useRef<HTMLDivElement>(null);
  const [gradientColors, setGradientColors] = useState({
    from: 'rgb(34, 211, 238)', // cyan-400
    via: 'rgb(59, 130, 246)', // blue-500
    to: 'rgb(168, 85, 247)', // purple-500
  });

  useEffect(() => {
    const handleMouseMove = throttle((e: MouseEvent) => {
      // Use viewport height for global tracking (Y position only)
      const viewportHeight = window.innerHeight;

      // Normalize Y position (0 to 1) based on viewport
      const normalizedY = e.clientY / viewportHeight;

      // Subtle color shift based on Y position
      // Limited color range: cyan (180) to purple (270) - 90 degree range
      const baseHue = 180 + normalizedY * 90; // Cyan to purple
      const hue1 = baseHue;
      const hue2 = baseHue + 20; // Slight variation
      const hue3 = baseHue + 40;

      // Moderate, consistent saturation and lightness
      const saturation = 75; // Moderate saturation
      const lightness = 60; // Consistent lightness

      setGradientColors({
        from: `hsl(${hue1}, ${saturation}%, ${lightness}%)`,
        via: `hsl(${hue2}, ${saturation}%, ${lightness}%)`,
        to: `hsl(${hue3}, ${saturation}%, ${lightness}%)`,
      });
    }, 16); // ~60fps throttling

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Get dragged algorithm info for preview and drop indicator
  const draggedAlgorithmInfo = useMemo(() => {
    if (!draggedAlgorithm) return null;
    const originalIndex = originalIndexByAlgorithmName.get(draggedAlgorithm) ?? 0;
    return {
      name: draggedAlgorithm,
      index: originalIndex,
      colorScheme: colorSchemes[originalIndex % colorSchemes.length],
    };
  }, [draggedAlgorithm, originalIndexByAlgorithmName]);

  // Check if drop position would actually change the order
  const wouldChangePosition = useMemo(() => {
    if (!draggedAlgorithm) return false;
    const currentIndex = orderedAlgorithmNames.indexOf(draggedAlgorithm);
    if (currentIndex === -1) return false;

    if (isSideBySideMode && targetAlgorithmCard) {
      // In side-by-side mode, check if target is different from dragged
      return targetAlgorithmCard !== draggedAlgorithm;
    } else if (dropPosition !== null) {
      // Normal mode: check if position would change
      let targetPosition = dropPosition;
      if (currentIndex < dropPosition) {
        targetPosition = dropPosition - 1;
      }
      return currentIndex !== targetPosition;
    }
    return false;
  }, [
    draggedAlgorithm,
    dropPosition,
    targetAlgorithmCard,
    orderedAlgorithmNames,
    isSideBySideMode,
  ]);

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 pt-4 pb-8 font-sans text-white">
      {/* Drag Preview */}
      {draggedAlgorithmInfo && dragPreviewPos && (
        <div
          data-drag-preview
          className="fixed pointer-events-none z-50"
          style={{
            left: `${dragPreviewPos.x}px`,
            top: `${dragPreviewPos.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <DragPreview
            algorithmName={draggedAlgorithmInfo.name}
            colorIndex={draggedAlgorithmInfo.index}
          />
        </div>
      )}

      <div
        ref={headerRef}
        className="text-center mb-2 animate-[fadeInDown_0.8s_ease-out] cursor-default"
      >
        <h1
          className="text-4xl font-bold m-0 bg-clip-text text-transparent tracking-tight leading-normal pb-1 transition-all duration-300"
          style={{
            backgroundImage: `linear-gradient(to right, ${gradientColors.from}, ${gradientColors.via}, ${gradientColors.to})`,
          }}
        >
          Backtesting Performance Analysis
        </h1>
        <div className="mt-2 flex items-center justify-center gap-3">
          {name && <p className="text-white/50 text-base">{name}</p>}
          <button
            type="button"
            onClick={() => setShareModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/25 text-white/55 hover:text-white/85 transition-all duration-200 cursor-pointer shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            {access?.isOwner === false ? 'Sharing info' : 'Share'}
            {access?.isPublic && (
              <span className="text-xs px-1.5 py-0.5 rounded-md bg-white/8 border border-white/10 text-white/35">
                Public
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Fixed position toggle button - only show when there are 2+ algorithms */}
      {orderedAlgorithmNames.length > 1 && (
        <button
          onClick={handleToggleSideBySide}
          disabled={isPending}
          className="fixed bottom-8 right-8 z-50 px-6 py-3 rounded-xl font-medium text-sm cursor-pointer transition-all duration-200 backdrop-blur-[10px] hover:-translate-y-1 flex items-center gap-2 shadow-lg border disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: isSideBySideMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(15, 23, 42, 0.8)',
            borderColor: isSideBySideMode ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)',
            color: isSideBySideMode ? '#60a5fa' : '#e2e8f0',
          }}
          onMouseEnter={(e) => {
            if (isSideBySideMode) {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.6)';
            } else {
              e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.9)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }
          }}
          onMouseLeave={(e) => {
            if (isSideBySideMode) {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
            } else {
              e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.8)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }
          }}
          aria-label={
            isSideBySideMode ? 'Disable side-by-side comparison' : 'Enable side-by-side comparison'
          }
        >
          {isSideBySideMode ? (
            <>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns={SVG_NAMESPACE}>
                {/* Two columns side by side icon */}
                {SIDE_BY_SIDE_RECTS.map((rect, idx) => (
                  <rect
                    key={idx}
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                    rx={rect.rx}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                  />
                ))}
              </svg>
              <span>Side-by-Side: ON</span>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns={SVG_NAMESPACE}>
                <path
                  d={SINGLE_COLUMN}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Side-by-Side: OFF</span>
            </>
          )}
        </button>
      )}

      <div className="max-w-[1400px] mx-auto">
        {/* Conditional grid layout: 2 columns when side-by-side mode is enabled, 1 column otherwise */}
        <div
          className={`grid gap-6 ${isSideBySideMode ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}
        >
          {/* Drop zone at the beginning (for first position) - only in normal mode */}
          {orderedAlgorithmNames.length > 0 && !isSideBySideMode && (
            <div
              data-drop-zone={0}
              className="relative z-20 h-[36px] flex items-center justify-center col-span-1"
              onMouseEnter={() => handleDropZoneHover(0)}
              onMouseUp={handleDragEnd}
              style={{
                pointerEvents: draggedAlgorithm ? 'auto' : 'none',
                // Position to match spacing of between-cards drop zones
                // Between-cards: drop zone center is at -12px relative to card below (12px above card)
                // For beginning: we want the line 12px above the first card
                // The drop zone is a grid item. The gap is 24px, so gap center is 12px from each edge
                // We want the drop zone center to align with the gap center (12px above first card)
                // Drop zone is 36px tall, center is 18px from top
                // If gap center is 12px above card, and gap starts 24px above card
                // Then gap center is 12px below gap start
                // Drop zone center should be 12px below gap start
                // So drop zone top should be at: gap start + 12px - 18px = gap start - 6px
                // Gap start is 24px above card, so drop zone top should be at 18px above card
                // But naturally, the drop zone would be positioned with its bottom at gap start
                // So naturally: bottom at 24px above card, top at 24px - 36px = -12px above card
                // We want: top at 18px above card
                // Difference: 18px - (-12px) = 30px, so move down by 30px
                // marginBottom: 30px moves the element down (positive moves down)
                marginBottom: '-30px', // Positions drop zone so line is 12px above card (matching between-cards)
              }}
            >
              {draggedAlgorithmInfo && dropPosition === 0 && wouldChangePosition && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-full px-6">
                    <div
                      className="w-full h-1 relative rounded-full"
                      style={{
                        background: `linear-gradient(to right, ${draggedAlgorithmInfo.colorScheme.primaryColor}, ${draggedAlgorithmInfo.colorScheme.primaryColorLight})`,
                      }}
                    >
                      <svg
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-slate-900 rounded-full p-1.5 shadow-lg"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns={SVG_NAMESPACE}
                      >
                        <path
                          d={PLUS}
                          stroke={draggedAlgorithmInfo.colorScheme.primaryColor}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Render algorithm cards in grid */}
          {orderedAlgorithmNames.map((algorithmName, index) => {
            const originalIndex = originalIndexByAlgorithmName.get(algorithmName) ?? index;
            const algorithmGraph = data.algorithmGraphs[originalIndex];
            const { aggregate } = algorithmGraph;
            // In side-by-side mode, determine if this is the first column (left side) of a row
            // In single column mode, all items are effectively "first column"
            const isFirstColumn = isSideBySideMode ? index % 2 === 0 : true;

            return (
              <div
                key={algorithmName}
                className="relative"
                style={{
                  // Ensure drop zones are not blocked by the card when dragging
                  zIndex: draggedAlgorithm === algorithmName ? 1 : 'auto',
                }}
              >
                {/* Drop zone before each position - positioned absolutely - only in normal mode */}
                {index > 0 && !isSideBySideMode && (
                  <div
                    data-drop-zone={index}
                    className="absolute z-20 h-[36px] left-0 right-0 flex items-center justify-center"
                    style={{
                      // Center the drop zone in the gap (gap-6 = 24px, 50% increase from 16px)
                      // Gap is 24px between cards, centered at 12px from each edge
                      // If card top is at 0, gap spans from -24px to 0px, center at -12px
                      // For 36px drop zone centered at -12px: top = -12px - 18px = -30px
                      top: '-30px', // Centers 36px drop zone in 24px gap
                      pointerEvents: draggedAlgorithm ? 'auto' : 'none',
                      // Ensure drop zones are always visible for hit detection
                      minWidth: '100%',
                      minHeight: '36px',
                    }}
                    onMouseEnter={() => handleDropZoneHover(index)}
                    onMouseUp={handleDragEnd}
                  >
                    {draggedAlgorithmInfo && dropPosition === index && wouldChangePosition && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {isFirstColumn && (
                          // Horizontal indicator for between rows
                          <div className="w-full px-6">
                            <div
                              className="w-full h-1 relative rounded-full"
                              style={{
                                background: `linear-gradient(to right, ${draggedAlgorithmInfo.colorScheme.primaryColor}, ${draggedAlgorithmInfo.colorScheme.primaryColorLight})`,
                              }}
                            >
                              <svg
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-slate-900 rounded-full p-1.5 shadow-lg"
                                viewBox="0 0 16 16"
                                fill="none"
                                xmlns={SVG_NAMESPACE}
                              >
                                <path
                                  d={PLUS}
                                  stroke={draggedAlgorithmInfo.colorScheme.primaryColor}
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* Algorithm card - this is the grid item */}
                <div
                  data-algorithm-card={algorithmName}
                  className="relative"
                  style={{
                    // Add visual indicators for side-by-side mode
                    ...(isSideBySideMode &&
                      targetAlgorithmCard === algorithmName &&
                      draggedAlgorithm &&
                      draggedAlgorithm !== algorithmName &&
                      draggedAlgorithmInfo && {
                        // Highlight target card
                        outline: `3px solid ${draggedAlgorithmInfo.colorScheme.primaryColor}40`,
                        outlineOffset: '4px',
                        borderRadius: '12px',
                      }),
                    // Animation for shifted algorithms - subtle slide effect
                    ...(shiftedAlgorithms.has(algorithmName) && {
                      animation: `${
                        shiftedAlgorithms.get(algorithmName) === 'left' ? 'slideLeft' : 'slideRight'
                      } 0.5s ease-out`,
                    }),
                  }}
                  onMouseUp={(e) => {
                    // Only handle drop in side-by-side mode when hovering over target card
                    if (
                      isSideBySideMode &&
                      draggedAlgorithm &&
                      targetAlgorithmCard === algorithmName &&
                      draggedAlgorithm !== algorithmName
                    ) {
                      e.stopPropagation();
                      handleDragEnd();
                    }
                  }}
                >
                  {/* Target card highlight for side-by-side mode */}
                  {isSideBySideMode &&
                    targetAlgorithmCard === algorithmName &&
                    draggedAlgorithm &&
                    draggedAlgorithm !== algorithmName &&
                    draggedAlgorithmInfo && (
                      <div
                        className="absolute inset-0 z-20 pointer-events-none rounded-xl"
                        style={{
                          background: `${draggedAlgorithmInfo.colorScheme.primaryColor}15`,
                          border: `2px dashed ${draggedAlgorithmInfo.colorScheme.primaryColor}60`,
                        }}
                      >
                        <div
                          className="absolute top-4 left-4 px-3 py-1.5 rounded-lg backdrop-blur-[10px] text-sm font-medium"
                          style={{
                            backgroundColor: `${draggedAlgorithmInfo.colorScheme.primaryColor}30`,
                            border: `1px solid ${draggedAlgorithmInfo.colorScheme.primaryColor}50`,
                            color: draggedAlgorithmInfo.colorScheme.primaryColorLight,
                          }}
                        >
                          Will take this position
                        </div>
                      </div>
                    )}
                  <div
                    style={{
                      // In side-by-side mode, allow pointer events on the card wrapper for drop detection
                      // The card itself will handle its own pointer events
                      pointerEvents:
                        isSideBySideMode && draggedAlgorithm && draggedAlgorithm !== algorithmName
                          ? 'auto'
                          : 'auto',
                    }}
                  >
                    <AlgorithmResultCard
                      algorithmGraph={algorithmGraph}
                      defaultTicker={defaultTickerByAggregate[aggregate]}
                      index={originalIndex}
                      isDragging={draggedAlgorithm === algorithmName}
                      isSideBySideMode={isSideBySideMode}
                      onCopyVersion={versionByName.has(algorithmName) && (access?.canCopy ?? false) ? () => setCopyModalVersion(versionByName.get(algorithmName)!) : undefined}
                      onDragEnd={handleDragEnd}
                      onDragStart={() => handleDragStart(algorithmName)}
                      tickerPlotByTicker={data.tickerPlotByAggregateByTicker[aggregate]}
                      timestamps={data.timestampsByAggregate[aggregate]}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {/* Drop zone at the end - only in normal mode */}
          {orderedAlgorithmNames.length > 0 && !isSideBySideMode && (
            <div
              data-drop-zone={orderedAlgorithmNames.length}
              className="relative z-20 h-[36px] flex items-center justify-center col-span-1"
              onMouseEnter={() => handleDropZoneHover(orderedAlgorithmNames.length)}
              onMouseUp={handleDragEnd}
              style={{
                pointerEvents: draggedAlgorithm ? 'auto' : 'none',
                // Position to match spacing of between-cards drop zones
                // Between-cards: drop zone center is at -12px relative to card below (12px above card)
                // For end: we want the line 12px below the last card
                // Drop zone center should be at 12px below card
                // Drop zone is 36px tall, center is 18px from top
                // So top should be at 12px - 18px = -6px relative to card bottom
                // The drop zone is a grid item with 24px gap above it
                // Naturally: top at gap start (24px below card), bottom at 24px + 36px = 60px below card
                // We want: top at -6px relative to card bottom (which is 6px above card bottom, or 18px above gap start)
                // Difference: -6px - 24px = -30px relative to gap start, so move up by 30px
                // marginTop: -30px moves the element up
                marginTop: '-30px', // Positions drop zone so line is 12px below card (matching between-cards)
              }}
            >
              {draggedAlgorithmInfo &&
                dropPosition === orderedAlgorithmNames.length &&
                wouldChangePosition && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-full px-6">
                      <div
                        className="w-full h-1 relative rounded-full"
                        style={{
                          background: `linear-gradient(to right, ${draggedAlgorithmInfo.colorScheme.primaryColor}, ${draggedAlgorithmInfo.colorScheme.primaryColorLight})`,
                        }}
                      >
                        <svg
                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-slate-900 rounded-full p-1.5 shadow-lg"
                          viewBox="0 0 16 16"
                          fill="none"
                          xmlns={SVG_NAMESPACE}
                        >
                          <path
                            d={PLUS}
                            stroke={draggedAlgorithmInfo.colorScheme.primaryColor}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>

    {copyModalVersion && (
      <CopyAlgorithmModal
        version={copyModalVersion}
        resultPublicId={publicId}
        onClose={() => setCopyModalVersion(null)}
      />
    )}
    {shareModalOpen && (
      <ShareModal
        publicId={publicId}
        isOwner={access?.isOwner ?? false}
        onClose={() => setShareModalOpen(false)}
      />
    )}
    </>
  );
}
