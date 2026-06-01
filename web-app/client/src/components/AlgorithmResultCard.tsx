import { BacktestChart } from '@client/components/BacktestChart';
import { HeadlineMetrics } from '@client/components/HeadlineMetrics';
import {
  DEFAULT_DESCRIPTION_METRIC_VISBILITY,
  type DescriptionMetricVisbility,
} from '@client/components/MetricTogglePanel/metricUtils';
import { PerformanceMetrics } from '@client/components/PerformanceMetrics';
import { ARROW_LEFT, STROKE_PROPERTIES, SVG_NAMESPACE } from '@client/icons/index';
import { colorSchemes } from '@client/utils/colorSchemes';
import { withCommasRounded } from '@client/utils/numberUtils';
import type { DescriptionMetrics, SimplePlot, Ticker, Timestamp } from '@shared/constants/trading';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  onCopyVersion?: () => void;
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
  onCopyVersion,
  onDragEnd,
  onDragStart,
  tickerPlotByTicker,
  timestamps,
}: AlgorithmResultCardProps) {
  // Memoize color scheme to avoid recalculation
  const colorScheme = useMemo(() => colorSchemes[index % colorSchemes.length], [index]);
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

  // Memoize callbacks to prevent unnecessary re-renders
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
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
  }, []);

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
  const handleMouseUp = useCallback(() => {
    if (isDragging && onDragEnd) {
      onDragEnd();
    }
    dragStartPos.current = null;
    setIsDragActive(false);
  }, [isDragging, onDragEnd]);

  // Memoize toggle callbacks
  const handleShowChart = useCallback(() => setIsMetricsPanelVisible(false), []);
  const handleShowMetrics = useCallback(() => setIsMetricsPanelVisible(true), []);

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
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2
              className={`text-xl font-bold bg-gradient-to-r ${colorScheme.gradientFrom} ${colorScheme.gradientTo} bg-clip-text text-transparent`}
            >
              {algorithmGraph.algorithmPlot.name}
            </h2>
            {onCopyVersion && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyVersion();
                }}
                title="Copy this algorithm version to your library"
                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs border border-white/10 bg-white/[0.04] text-white/40 hover:text-white/80 hover:bg-white/[0.08] hover:border-white/20 transition-all cursor-pointer"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Copy
              </button>
            )}
          </div>
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
                  onClick={handleShowChart}
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
                  onToggle={handleShowChart}
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
                  onClick={handleShowMetrics}
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
                  onToggle={handleShowChart}
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
                  onClick={handleShowMetrics}
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
