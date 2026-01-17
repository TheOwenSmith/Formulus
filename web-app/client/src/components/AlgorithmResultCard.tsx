import { BacktestChart } from '@client/components/BacktestChart';
import { HeadlineMetrics } from '@client/components/HeadlineMetrics';
import {
  DEFAULT_DESCRIPTION_METRIC_VISBILITY,
  type DescriptionMetricVisbility,
} from '@client/components/MetricTogglePanel/metricUtils';
import { PerformanceMetrics } from '@client/components/PerformanceMetrics';
import { ARROW_LEFT, STROKE_PROPERTIES, SVG_NAMESPACE } from '@client/icons/index';
import { withCommasRounded } from '@client/utils/numberUtils';
import type { DescriptionMetrics, SimplePlot, Ticker, Timestamp } from '@shared/types';
import { memo, useEffect, useRef, useState } from 'react';

// Color scheme definitions for different algorithm cards
const colorSchemes = [
  {
    accentBorder: 'border-blue-500/20',
    bgGradient: 'from-blue-950/20',
    bgGradientTo: 'to-cyan-950/20',
    borderColor: 'border-blue-500/30',
    buttonBg: 'bg-blue-500/20',
    buttonBorder: 'border-blue-500/40',
    buttonHoverBg: 'hover:bg-blue-500/30',
    buttonHoverBorder: 'hover:border-blue-500/60',
    buttonText: 'text-blue-400',
    // Blue to Cyan - more contrast
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-cyan-300',
    primaryColor: '#3b82f6', // blue-500
    primaryColorLight: '#60a5fa', // blue-400
    shadowColor: 'shadow-blue-500/10',
  },
  {
    accentBorder: 'border-emerald-500/20',
    bgGradient: 'from-emerald-950/20',
    bgGradientTo: 'to-teal-950/20',
    borderColor: 'border-emerald-500/30',
    buttonBg: 'bg-emerald-500/20',
    buttonBorder: 'border-emerald-500/40',
    buttonHoverBg: 'hover:bg-emerald-500/30',
    buttonHoverBorder: 'hover:border-emerald-500/60',
    buttonText: 'text-emerald-400',
    // Emerald to Teal - more contrast
    gradientFrom: 'from-emerald-500',
    gradientTo: 'to-teal-300',
    primaryColor: '#10b981', // emerald-500
    primaryColorLight: '#34d399', // emerald-400
    shadowColor: 'shadow-emerald-500/10',
  },
  {
    accentBorder: 'border-purple-500/20',
    bgGradient: 'from-purple-950/20',
    bgGradientTo: 'to-pink-950/20',
    borderColor: 'border-purple-500/30',
    buttonBg: 'bg-purple-500/20',
    buttonBorder: 'border-purple-500/40',
    buttonHoverBg: 'hover:bg-purple-500/30',
    buttonHoverBorder: 'hover:border-purple-500/60',
    buttonText: 'text-purple-400',
    // Purple to Pink - more contrast
    gradientFrom: 'from-purple-600',
    gradientTo: 'to-pink-300',
    primaryColor: '#a855f7', // purple-500
    primaryColorLight: '#c084fc', // purple-400
    shadowColor: 'shadow-purple-500/10',
  },
  {
    accentBorder: 'border-orange-500/20',
    bgGradient: 'from-orange-950/20',
    bgGradientTo: 'to-red-950/20',
    borderColor: 'border-orange-500/30',
    buttonBg: 'bg-orange-500/20',
    buttonBorder: 'border-orange-500/40',
    buttonHoverBg: 'hover:bg-orange-500/30',
    buttonHoverBorder: 'hover:border-orange-500/60',
    buttonText: 'text-orange-400',
    // Orange to Red - more contrast
    gradientFrom: 'from-orange-500',
    gradientTo: 'to-red-600',
    primaryColor: '#f97316', // orange-500
    primaryColorLight: '#fb923c', // orange-400
    shadowColor: 'shadow-orange-500/10',
  },
  {
    accentBorder: 'border-indigo-500/20',
    bgGradient: 'from-indigo-950/20',
    bgGradientTo: 'to-violet-950/20',
    borderColor: 'border-indigo-500/30',
    buttonBg: 'bg-indigo-500/20',
    buttonBorder: 'border-indigo-500/40',
    buttonHoverBg: 'hover:bg-indigo-500/30',
    buttonHoverBorder: 'hover:border-indigo-500/60',
    buttonText: 'text-indigo-400',
    // Indigo to Violet - more contrast
    gradientFrom: 'from-indigo-600',
    gradientTo: 'to-violet-300',
    primaryColor: '#6366f1', // indigo-500
    primaryColorLight: '#818cf8', // indigo-400
    shadowColor: 'shadow-indigo-500/10',
  },
  {
    accentBorder: 'border-yellow-500/20',
    bgGradient: 'from-yellow-950/20',
    bgGradientTo: 'to-amber-950/20',
    borderColor: 'border-yellow-500/30',
    buttonBg: 'bg-yellow-500/20',
    buttonBorder: 'border-yellow-500/40',
    buttonHoverBg: 'hover:bg-yellow-500/30',
    buttonHoverBorder: 'hover:border-yellow-500/60',
    buttonText: 'text-yellow-400',
    // Yellow to Amber - more contrast
    gradientFrom: 'from-yellow-500',
    gradientTo: 'to-amber-300',
    primaryColor: '#eab308', // yellow-500
    primaryColorLight: '#facc15', // yellow-400
    shadowColor: 'shadow-yellow-500/10',
  },
  {
    accentBorder: 'border-rose-500/20',
    bgGradient: 'from-rose-950/20',
    bgGradientTo: 'to-fuchsia-950/20',
    borderColor: 'border-rose-500/30',
    buttonBg: 'bg-rose-500/20',
    buttonBorder: 'border-rose-500/40',
    buttonHoverBg: 'hover:bg-rose-500/30',
    buttonHoverBorder: 'hover:border-rose-500/60',
    buttonText: 'text-rose-400',
    // Rose to Fuchsia - more contrast
    gradientFrom: 'from-rose-600',
    gradientTo: 'to-fuchsia-300',
    primaryColor: '#f43f5e', // rose-500
    primaryColorLight: '#fb7185', // rose-400
    shadowColor: 'shadow-rose-500/10',
  },
  {
    accentBorder: 'border-sky-500/20',
    bgGradient: 'from-sky-950/20',
    bgGradientTo: 'to-blue-950/20',
    borderColor: 'border-sky-500/30',
    buttonBg: 'bg-sky-500/20',
    buttonBorder: 'border-sky-500/40',
    buttonHoverBg: 'hover:bg-sky-500/30',
    buttonHoverBorder: 'hover:border-sky-500/60',
    buttonText: 'text-sky-400',
    // Sky to Blue - more contrast
    gradientFrom: 'from-sky-500',
    gradientTo: 'to-blue-300',
    primaryColor: '#0ea5e9', // sky-500
    primaryColorLight: '#38bdf8', // sky-400
    shadowColor: 'shadow-sky-500/10',
  },
];

interface AlgorithmResultCardProps {
  algorithmGraph: {
    aggregate: Timestamp;
    descriptionMetrics: DescriptionMetrics;
    algorithmPlot: SimplePlot;
  };
  defaultTicker: Ticker;
  index: number; // Index for color scheme selection
  isDragging?: boolean;
  isSideBySideMode?: boolean;
  onDragEnd?: () => void;
  onDragStart?: () => void;
  tickerPlotByTicker: Record<Ticker, SimplePlot>;
  timestamps: string[];
}

function AlgorithmResultCardComponent({
  algorithmGraph,
  defaultTicker,
  index,
  isDragging,
  isSideBySideMode,
  onDragEnd,
  onDragStart,
  tickerPlotByTicker,
  timestamps,
}: AlgorithmResultCardProps) {
  // Get color scheme for this card (cycle through available schemes)
  const colorScheme = colorSchemes[index % colorSchemes.length];
  const [selectedTicker, setSelectedTicker] = useState<Ticker>(defaultTicker);
  // In side-by-side mode, show graph by default (false). In normal mode, show metrics panel by default (true).
  const [isMetricsPanelVisible, setIsMetricsPanelVisible] = useState(!isSideBySideMode);
  const [isDragActive, setIsDragActive] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  // Track previous side-by-side mode to detect changes
  const prevSideBySideModeRef = useRef(isSideBySideMode);

  // Sync metrics panel visibility when side-by-side mode changes
  // Use a ref-based approach to avoid unnecessary re-renders
  useEffect(() => {
    // Only update if side-by-side mode actually changed
    if (prevSideBySideModeRef.current !== isSideBySideMode) {
      prevSideBySideModeRef.current = isSideBySideMode;
      // Schedule state update in next tick to avoid cascading renders
      requestAnimationFrame(() => {
        setIsMetricsPanelVisible(!isSideBySideMode);
      });
    }
  }, [isSideBySideMode]);

  const [metricVisibility, setMetricVisibility] = useState<DescriptionMetricVisbility>(() => ({
    ...DEFAULT_DESCRIPTION_METRIC_VISBILITY,
  }));

  // Handle mouse down for drag start
  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start drag if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('[role="button"]') ||
      target.closest('svg') ||
      target.closest('path')
    ) {
      return;
    }

    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setIsDragActive(true);
  };

  // Handle mouse move to detect drag
  useEffect(() => {
    if (!isDragActive || !dragStartPos.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartPos.current) return;

      const deltaX = Math.abs(e.clientX - dragStartPos.current.x);
      const deltaY = Math.abs(e.clientY - dragStartPos.current.y);
      const threshold = 5; // pixels

      if (deltaX > threshold || deltaY > threshold) {
        // Drag threshold exceeded, start dragging
        if (onDragStart) {
          onDragStart();
        }
        dragStartPos.current = null;
        setIsDragActive(false);
      }
    };

    const handleMouseUp = () => {
      dragStartPos.current = null;
      setIsDragActive(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragActive, onDragStart]);

  // Handle mouse up for drag end
  const handleMouseUp = () => {
    if (isDragging && onDragEnd) {
      onDragEnd();
    }
    dragStartPos.current = null;
    setIsDragActive(false);
  };

  return (
    <div
      ref={cardRef}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className={`bg-gradient-to-br ${colorScheme.bgGradient} ${colorScheme.bgGradientTo} rounded-2xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] border ${colorScheme.borderColor} relative overflow-hidden transition-all duration-300 ${
        isDragging
          ? 'opacity-50 scale-[0.98] shadow-[0_30px_80px_rgba(0,0,0,0.5)]'
          : 'hover:shadow-[0_25px_70px_rgba(0,0,0,0.4)]'
      } ${isDragActive || isDragging ? 'select-none cursor-grabbing' : ''}`}
      style={{
        userSelect: isDragActive || isDragging ? 'none' : 'auto',
        pointerEvents: isDragging ? 'none' : 'auto',
      }}
    >
      {/* Subtle gradient overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${colorScheme.gradientFrom}/5 ${colorScheme.gradientTo}/5 pointer-events-none`}
      />
      <div className="relative z-10">
        {/* Algorithm Header */}
        <div className="mb-4">
          <h2
            className={`text-xl font-bold mb-1 bg-gradient-to-r ${colorScheme.gradientFrom} ${colorScheme.gradientTo} bg-clip-text text-transparent`}
          >
            {algorithmGraph.algorithmPlot.name}
          </h2>
          <div className="text-xs text-white/60">
            Algorithm Return: {algorithmGraph.descriptionMetrics.algorithmReturn >= 0 ? '+' : ''}
            {withCommasRounded(algorithmGraph.descriptionMetrics.algorithmReturn * 100)}% | Growth
            Rate: {algorithmGraph.descriptionMetrics.growthRate >= 0 ? '+' : ''}
            {withCommasRounded(algorithmGraph.descriptionMetrics.growthRate * 100)}% APY
          </div>
        </div>

        {/* Headline Metrics */}
        <div className="mb-4">
          <HeadlineMetrics
            descriptionMetrics={algorithmGraph.descriptionMetrics}
            gradientFrom={colorScheme.gradientFrom}
            gradientTo={colorScheme.gradientTo}
            isSideBySideMode={isSideBySideMode}
            primaryColor={colorScheme.primaryColor}
            selectedTickerPlot={tickerPlotByTicker[selectedTicker]}
          />
        </div>

        {/* Chart and Metrics */}
        {isSideBySideMode ? (
          /* Side-by-side mode: Show either metrics OR graph, not both - with animation */
          <div className="relative" style={{ height: '480px' }}>
            {/* Metrics panel with fade/slide animation */}
            <div
              className={`absolute inset-0 w-full h-full transition-all duration-500 ease-in-out ${
                isMetricsPanelVisible
                  ? 'opacity-100 translate-x-0 z-20'
                  : 'opacity-0 -translate-x-4 z-0'
              }`}
              style={{
                pointerEvents: isMetricsPanelVisible ? 'auto' : 'none',
              }}
            >
              <div
                className="relative w-full h-full"
                style={{
                  pointerEvents: isMetricsPanelVisible ? 'auto' : 'none',
                }}
              >
                <button
                  onClick={() => setIsMetricsPanelVisible(false)}
                  className="absolute top-4 right-4 z-10 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 backdrop-blur-[10px] hover:-translate-y-px flex items-center gap-2 shadow-lg"
                  style={{
                    backgroundColor: `${colorScheme.primaryColor}20`,
                    border: `1px solid ${colorScheme.primaryColor}40`,
                    color: colorScheme.primaryColorLight,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${colorScheme.primaryColor}30`;
                    e.currentTarget.style.borderColor = `${colorScheme.primaryColor}60`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = `${colorScheme.primaryColor}20`;
                    e.currentTarget.style.borderColor = `${colorScheme.primaryColor}40`;
                  }}
                  aria-label="Show chart"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns={SVG_NAMESPACE}
                    className="transition-transform duration-200"
                  >
                    <path d={ARROW_LEFT} {...STROKE_PROPERTIES} />
                  </svg>
                  <span>Show Chart</span>
                </button>
                <PerformanceMetrics
                  descriptionMetrics={algorithmGraph.descriptionMetrics}
                  hideToggleButton={isSideBySideMode}
                  metricVisibility={metricVisibility}
                  onToggle={() => setIsMetricsPanelVisible(false)}
                  primaryColor={colorScheme.primaryColor}
                  primaryColorLight={colorScheme.primaryColorLight}
                  setMetricVisibility={setMetricVisibility}
                />
              </div>
            </div>

            {/* Graph with fade/slide animation */}
            <div
              className={`absolute inset-0 w-full h-full transition-all duration-500 ease-in-out ${
                !isMetricsPanelVisible
                  ? 'opacity-100 translate-x-0 z-10'
                  : 'opacity-0 translate-x-4 z-0'
              }`}
              style={{
                pointerEvents: !isMetricsPanelVisible ? 'auto' : 'none',
              }}
            >
              <div
                className="relative w-full h-full"
                style={{
                  pointerEvents: !isMetricsPanelVisible ? 'auto' : 'none',
                }}
              >
                <button
                  onClick={() => setIsMetricsPanelVisible(true)}
                  className="absolute top-4 left-4 z-10 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 backdrop-blur-[10px] hover:-translate-y-px flex items-center gap-2 shadow-lg"
                  style={{
                    backgroundColor: `${colorScheme.primaryColor}20`,
                    border: `1px solid ${colorScheme.primaryColor}40`,
                    color: colorScheme.primaryColorLight,
                    pointerEvents: !isMetricsPanelVisible ? 'auto' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isMetricsPanelVisible) {
                      e.currentTarget.style.backgroundColor = `${colorScheme.primaryColor}30`;
                      e.currentTarget.style.borderColor = `${colorScheme.primaryColor}60`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isMetricsPanelVisible) {
                      e.currentTarget.style.backgroundColor = `${colorScheme.primaryColor}20`;
                      e.currentTarget.style.borderColor = `${colorScheme.primaryColor}40`;
                    }
                  }}
                  aria-label="Show metrics panel"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns={SVG_NAMESPACE}
                    className="transition-transform duration-200 rotate-180"
                  >
                    <path d={ARROW_LEFT} {...STROKE_PROPERTIES} />
                  </svg>
                  <span>Show Metrics</span>
                </button>
                {/* Render graph but disable interactions when hidden */}
                <div
                  style={{
                    pointerEvents: !isMetricsPanelVisible ? 'auto' : 'none',
                    width: '100%',
                    height: '100%',
                    cursor: !isMetricsPanelVisible ? 'default' : 'default',
                  }}
                >
                  <BacktestChart
                    algorithmColor={colorScheme.primaryColor}
                    algorithmPlot={algorithmGraph.algorithmPlot}
                    availableTickers={Object.keys(tickerPlotByTicker)}
                    gradientFrom={colorScheme.gradientFrom}
                    gradientTo={colorScheme.gradientTo}
                    isSideBySideMode={isSideBySideMode}
                    onTickerChange={setSelectedTicker}
                    selectedTicker={selectedTicker}
                    tickerPlot={tickerPlotByTicker[selectedTicker]}
                    timestamps={timestamps}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Normal mode: Show metrics and graph side-by-side */
          <div className="flex flex-col lg:flex-row gap-4" style={{ height: '480px' }}>
            {/* Performance metrics panel (left) */}
            <div
              className={`transition-all duration-300 ${
                isMetricsPanelVisible
                  ? 'w-full lg:w-[33%] lg:min-w-[300px] lg:flex-shrink-0 opacity-100'
                  : 'w-0 opacity-0 overflow-hidden lg:min-w-0'
              }`}
              style={{ height: '100%' }}
            >
              {isMetricsPanelVisible && (
                <PerformanceMetrics
                  descriptionMetrics={algorithmGraph.descriptionMetrics}
                  metricVisibility={metricVisibility}
                  onToggle={() => setIsMetricsPanelVisible(false)}
                  primaryColor={colorScheme.primaryColor}
                  primaryColorLight={colorScheme.primaryColorLight}
                  setMetricVisibility={setMetricVisibility}
                />
              )}
            </div>

            {/* Main graph (right) */}
            <div className="flex-1 w-full min-w-0 relative" style={{ height: '100%' }}>
              {!isMetricsPanelVisible && (
                <button
                  onClick={() => setIsMetricsPanelVisible(true)}
                  className="absolute top-4 left-4 z-10 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 backdrop-blur-[10px] hover:-translate-y-px flex items-center gap-2 shadow-lg"
                  style={{
                    backgroundColor: `${colorScheme.primaryColor}20`,
                    border: `1px solid ${colorScheme.primaryColor}40`,
                    color: colorScheme.primaryColorLight,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${colorScheme.primaryColor}30`;
                    e.currentTarget.style.borderColor = `${colorScheme.primaryColor}60`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = `${colorScheme.primaryColor}20`;
                    e.currentTarget.style.borderColor = `${colorScheme.primaryColor}40`;
                  }}
                  aria-label="Show metrics panel"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns={SVG_NAMESPACE}
                    className="transition-transform duration-200 rotate-180"
                  >
                    <path d={ARROW_LEFT} {...STROKE_PROPERTIES} />
                  </svg>
                  <span>Show Metrics</span>
                </button>
              )}
              <BacktestChart
                algorithmColor={colorScheme.primaryColor}
                algorithmPlot={algorithmGraph.algorithmPlot}
                availableTickers={Object.keys(tickerPlotByTicker)}
                gradientFrom={colorScheme.gradientFrom}
                gradientTo={colorScheme.gradientTo}
                isSideBySideMode={isSideBySideMode}
                onTickerChange={setSelectedTicker}
                selectedTicker={selectedTicker}
                tickerPlot={tickerPlotByTicker[selectedTicker]}
                timestamps={timestamps}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders when props haven't changed
export const AlgorithmResultCard = memo(AlgorithmResultCardComponent);
