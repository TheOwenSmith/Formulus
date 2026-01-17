import { AlgorithmResultCard } from '@client/components/AlgorithmResultCard';
import { PLUS, SIDE_BY_SIDE_RECTS, SINGLE_COLUMN, SVG_NAMESPACE } from '@client/icons/index';
import '@client/styles/BacktestPage.css';
import { calculateTargetPosition } from '@client/utils/gridLayoutUtils';
import type { BacktestAlgorithmsResult, Ticker, Timestamp } from '@shared/types';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useLoaderData } from 'react-router-dom';

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

export function BacktestPage() {
  const { data } = useLoaderData<{ data: BacktestAlgorithmsResult }>();

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
    if (draggedAlgorithm !== null && dropPosition !== null) {
      // Use startTransition to mark reordering as non-urgent, preventing unmount errors
      startTransition(() => {
        // Use functional update to avoid stale closure issues
        setOrderedAlgorithmNames((prevOrder) => {
          const currentIndex = prevOrder.indexOf(draggedAlgorithm);
          if (currentIndex === -1) return prevOrder;

          // Calculate the target position using grid layout utility
          const targetPosition = calculateTargetPosition(
            currentIndex,
            dropPosition,
            prevOrder.length,
          );

          // Only reorder if position actually changed
          if (currentIndex !== targetPosition) {
            const newOrder = [...prevOrder];
            newOrder.splice(currentIndex, 1);
            newOrder.splice(targetPosition, 0, draggedAlgorithm);
            return newOrder;
          }
          return prevOrder;
        });
      });
    }
    // Batch state updates to prevent React errors
    setDraggedAlgorithm(null);
    setDropPosition(null);
    setDragPreviewPos(null);
  }, [draggedAlgorithm, dropPosition]);

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

    const handleMouseMove = (e: MouseEvent) => {
      mouseY = e.clientY;
      setDragPreviewPos({ x: e.clientX + 20, y: e.clientY + 20 });

      // Find drop zone by checking all drop zones and their bounding boxes
      const dropZones = document.querySelectorAll('[data-drop-zone]');
      let foundPosition: number | null = null;

      for (const dropZone of dropZones) {
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
      } else {
        // Also try elementsFromPoint as fallback
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        for (const el of elements) {
          const dropZone = el.closest('[data-drop-zone]');
          if (dropZone) {
            const position = parseInt(dropZone.getAttribute('data-drop-zone') ?? '-1', 10);
            if (position >= 0) {
              setDropPosition(position);
              return;
            }
          }
        }
        // Clear drop position if not over any drop zone
        setDropPosition(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
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
  }, [draggedAlgorithm]);

  // Interactive gradient based on global cursor position
  const headerRef = useRef<HTMLDivElement>(null);
  const [gradientColors, setGradientColors] = useState({
    from: 'rgb(34, 211, 238)', // cyan-400
    via: 'rgb(59, 130, 246)', // blue-500
    to: 'rgb(168, 85, 247)', // purple-500
  });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
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
    };

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
    if (!draggedAlgorithm || dropPosition === null) return false;
    const currentIndex = orderedAlgorithmNames.indexOf(draggedAlgorithm);
    if (currentIndex === -1) return false;

    let targetPosition = dropPosition;
    if (currentIndex < dropPosition) {
      targetPosition = dropPosition - 1;
    }

    return currentIndex !== targetPosition;
  }, [draggedAlgorithm, dropPosition, orderedAlgorithmNames]);

  return (
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
      </div>

      {/* Fixed position toggle button */}
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

      <div className="max-w-[1400px] mx-auto">
        {/* Conditional grid layout: 2 columns when side-by-side mode is enabled, 1 column otherwise */}
        <div
          className={`grid gap-6 ${isSideBySideMode ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}
        >
          {/* Drop zone at the beginning (for first position) */}
          {orderedAlgorithmNames.length > 0 && (
            <div
              data-drop-zone={0}
              className={`relative z-20 h-[36px] flex items-center justify-center ${
                isSideBySideMode ? 'col-span-2' : 'col-span-1'
              }`}
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
                {/* Drop zone before each position - positioned absolutely */}
                {index > 0 && (
                  <div
                    data-drop-zone={index}
                    className={`absolute z-20 flex items-center justify-center ${
                      isFirstColumn ? 'h-[36px] left-0 right-0' : 'w-[36px] top-0 bottom-0'
                    }`}
                    style={{
                      // Center the drop zone in the gap (gap-6 = 24px, 50% increase from 16px)
                      // Gap is 24px between cards, centered at 12px from each edge
                      // If card top is at 0, gap spans from -24px to 0px, center at -12px
                      // For 36px drop zone centered at -12px: top = -12px - 18px = -30px
                      ...(isFirstColumn
                        ? {
                            top: '-30px', // Centers 36px drop zone in 24px gap
                          }
                        : {
                            left: '-30px', // Centers 36px drop zone in 24px gap
                          }),
                      pointerEvents: draggedAlgorithm ? 'auto' : 'none',
                      // Ensure drop zones are always visible for hit detection
                      minWidth: isFirstColumn ? '100%' : '36px',
                      minHeight: isFirstColumn ? '36px' : '100%',
                    }}
                    onMouseEnter={() => handleDropZoneHover(index)}
                    onMouseUp={handleDragEnd}
                  >
                    {draggedAlgorithmInfo && dropPosition === index && wouldChangePosition && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {isFirstColumn ? (
                          // Horizontal indicator for between rows (or single column mode)
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
                        ) : (
                          // Vertical indicator for between columns (only in side-by-side mode)
                          <div className="h-full px-3">
                            <div
                              className="h-full w-1 relative rounded-full"
                              style={{
                                background: `linear-gradient(to bottom, ${draggedAlgorithmInfo.colorScheme.primaryColor}, ${draggedAlgorithmInfo.colorScheme.primaryColorLight})`,
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
                <AlgorithmResultCard
                  algorithmGraph={algorithmGraph}
                  defaultTicker={defaultTickerByAggregate[aggregate]}
                  index={originalIndex}
                  isDragging={draggedAlgorithm === algorithmName}
                  isSideBySideMode={isSideBySideMode}
                  onDragEnd={handleDragEnd}
                  onDragStart={() => handleDragStart(algorithmName)}
                  tickerPlotByTicker={data.tickerPlotByAggregateByTicker[aggregate]}
                  timestamps={data.timestampsByAggregate[aggregate]}
                />
              </div>
            );
          })}
          {/* Drop zone at the end */}
          {orderedAlgorithmNames.length > 0 && (
            <div
              data-drop-zone={orderedAlgorithmNames.length}
              className={`relative z-20 h-[36px] flex items-center justify-center ${
                isSideBySideMode ? 'col-span-2' : 'col-span-1'
              }`}
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
  );
}
