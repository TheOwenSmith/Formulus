import { AlgorithmResultCard } from '@client/components/AlgorithmResultCard';
import '@client/styles/BacktestPage.css';
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Graph } from '../types';

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

interface BacktestPageProps {
  data: Graph;
}

export function BacktestPage({ data }: BacktestPageProps) {
  // Get available tickers and default ticker
  const availableTickers = useMemo(() => {
    if (data.tickerPlots) {
      return Object.keys(data.tickerPlots);
    }
    // Legacy support
    if (data.tickerPlot) {
      return [data.tickerPlot.name];
    }
    return [];
  }, [data]);

  const defaultTicker = useMemo(() => {
    if (data.tickerPlots) {
      return Object.keys(data.tickerPlots)[0] ?? '';
    }
    return data.tickerPlot?.name ?? '';
  }, [data]);

  // Get algorithm plots - support both new (algorithmPlots) and legacy (algorithmPlot) formats
  const algorithmPlots = useMemo(() => {
    if (data.algorithmPlots) {
      return data.algorithmPlots;
    }
    // Legacy support
    if (data.algorithmPlot && data.algorithmName) {
      return { [data.algorithmName]: data.algorithmPlot };
    }
    return {};
  }, [data]);

  // Track original order for color scheme mapping
  const originalAlgorithmNames = useMemo(() => Object.keys(algorithmPlots), [algorithmPlots]);

  // State for reordered algorithm names
  const [orderedAlgorithmNames, setOrderedAlgorithmNames] = useState<string[]>(() =>
    Object.keys(algorithmPlots),
  );

  // Drag and drop state
  const [draggedAlgorithm, setDraggedAlgorithm] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<number | null>(null);
  const [dragPreviewPos, setDragPreviewPos] = useState<{ x: number; y: number } | null>(null);

  // Map algorithm names to their original indices for color schemes
  const algorithmIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    originalAlgorithmNames.forEach((name, index) => {
      map.set(name, index);
    });
    return map;
  }, [originalAlgorithmNames]);

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

          // Calculate the target position
          let targetPosition = dropPosition;
          if (currentIndex < dropPosition) {
            targetPosition = dropPosition - 1;
          }

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
        // Check if mouse is within the drop zone area (with some padding for easier targeting)
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top - 10 &&
          e.clientY <= rect.bottom + 10
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

  const algorithmNames = orderedAlgorithmNames;

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
    const originalIndex = algorithmIndexMap.get(draggedAlgorithm) ?? 0;
    return {
      name: draggedAlgorithm,
      index: originalIndex,
      colorScheme: colorSchemes[originalIndex % colorSchemes.length],
    };
  }, [draggedAlgorithm, algorithmIndexMap]);

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

      <div className="max-w-[1400px] mx-auto">
        {/* Drop zone at the beginning (for first position) */}
        {algorithmNames.length > 0 && (
          <div
            data-drop-zone={0}
            className="relative h-[36px] -mb-[18px] flex items-center justify-center"
            onMouseEnter={() => handleDropZoneHover(0)}
            onMouseUp={handleDragEnd}
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
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M8 4V12M4 8H12"
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
        {/* Render one card per algorithm */}
        {algorithmNames.map((algorithmName, index) => {
          const originalIndex = algorithmIndexMap.get(algorithmName) ?? index;
          return (
            <div key={algorithmName}>
              {/* Drop zone indicator above each card */}
              {index > 0 && (
                <div
                  data-drop-zone={index}
                  className="relative h-[36px] -mt-[18px] -mb-[18px] flex items-center justify-center"
                  onMouseEnter={() => handleDropZoneHover(index)}
                  onMouseUp={handleDragEnd}
                >
                  {draggedAlgorithmInfo && dropPosition === index && wouldChangePosition && (
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
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M8 4V12M4 8H12"
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
              <AlgorithmResultCard
                algorithmName={algorithmName}
                algorithmPlot={algorithmPlots[algorithmName]}
                fullData={data}
                availableTickers={availableTickers}
                defaultTicker={defaultTicker}
                index={originalIndex}
                isDragging={draggedAlgorithm === algorithmName}
                onDragStart={() => handleDragStart(algorithmName)}
                onDragEnd={handleDragEnd}
              />
            </div>
          );
        })}
        {/* Drop zone at the end */}
        {algorithmNames.length > 0 && (
          <div
            data-drop-zone={algorithmNames.length}
            className="relative h-[36px] -mt-[18px] flex items-center justify-center"
            onMouseEnter={() => handleDropZoneHover(algorithmNames.length)}
            onMouseUp={handleDragEnd}
          >
            {draggedAlgorithmInfo &&
              dropPosition === algorithmNames.length &&
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
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M8 4V12M4 8H12"
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
  );
}
