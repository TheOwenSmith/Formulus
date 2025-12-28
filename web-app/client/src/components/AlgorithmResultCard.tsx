import { BacktestChart } from '@client/components/BacktestChart';
import { HeadlineMetrics } from '@client/components/HeadlineMetrics';
import {
  createMetricMap,
  DEFAULT_METRIC_OPTIONS,
  type MetricKey,
} from '@client/components/MetricTogglePanel/metricUtils';
import { PerformanceMetrics } from '@client/components/PerformanceMetrics';
import type { Graph } from '@client/types';
import { useEffect, useMemo, useRef, useState } from 'react';

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
  algorithmName: string;
  algorithmPlot: { name: string; y: number[] };
  fullData: Graph;
  availableTickers: string[];
  defaultTicker: string;
  index: number; // Index for color scheme selection
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function AlgorithmResultCard({
  algorithmName,
  algorithmPlot,
  fullData,
  availableTickers,
  defaultTicker,
  index,
  isDragging = false,
  onDragStart,
  onDragEnd,
}: AlgorithmResultCardProps) {
  // Get color scheme for this card (cycle through available schemes)
  const colorScheme = colorSchemes[index % colorSchemes.length];
  const [selectedTicker, setSelectedTicker] = useState<string>(defaultTicker);
  const [isMetricsPanelVisible, setIsMetricsPanelVisible] = useState(true);
  const [isDragActive, setIsDragActive] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  // Get the selected ticker plot
  const selectedTickerPlot = useMemo(() => {
    if (fullData.tickerPlots && selectedTicker) {
      return fullData.tickerPlots[selectedTicker];
    }
    return fullData.tickerPlot;
  }, [fullData, selectedTicker]);

  // Calculate growth rate for this algorithm
  const initialValue = algorithmPlot.y[0];
  const finalValue = algorithmPlot.y[algorithmPlot.y.length - 1];
  const algorithmReturn = ((finalValue - initialValue) / initialValue) * 100;

  // Calculate years between start and end for APY calculation
  // Estimate based on timestamps if available
  let yearsBetween = 1; // Default to 1 year
  if (fullData.timestamps.length > 1) {
    const startDate = new Date(fullData.timestamps[0].replace(' ', 'T'));
    const endDate = new Date(fullData.timestamps[fullData.timestamps.length - 1].replace(' ', 'T'));
    const daysBetween = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    yearsBetween = daysBetween / 365.25;
  }

  const growthRate =
    yearsBetween > 0 ? Math.pow(finalValue / initialValue, 1 / yearsBetween) - 1 : 0;

  // Create a single-algorithm Graph for this component
  const algorithmData: Graph = useMemo(() => {
    const result: Graph = {
      ...fullData,
      algorithmName: algorithmName,
      algorithmPlot: algorithmPlot,
      growthRate: growthRate,
      sharpeRatio: fullData.sharpeRatio, // Use shared sharpe ratio for now, could calculate per-algorithm
    };
    if (selectedTickerPlot) {
      result.tickerPlot = selectedTickerPlot;
    }
    return result;
  }, [fullData, algorithmPlot, algorithmName, growthRate, selectedTickerPlot]);

  // Metrics state
  const metricMap = useMemo(() => createMetricMap(fullData.description), [fullData.description]);
  const availableMetrics = useMemo(() => new Set(metricMap.keys()), [metricMap]);

  const [enabledMetrics, setEnabledMetrics] = useState<Record<MetricKey, boolean>>(() => {
    const initial: Record<MetricKey, boolean> = { ...DEFAULT_METRIC_OPTIONS };
    const tempMetricMap = createMetricMap(fullData.description);
    const availableSet = new Set(tempMetricMap.keys());
    for (const metric of availableSet) {
      initial[metric] = DEFAULT_METRIC_OPTIONS[metric];
    }
    return initial;
  });

  const handleToggleMetric = (metric: MetricKey, enabled: boolean) => {
    setEnabledMetrics((prev) => ({ ...prev, [metric]: enabled }));
  };

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
      className={`bg-gradient-to-br ${colorScheme.bgGradient} ${colorScheme.bgGradientTo} rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] my-[18px] border ${colorScheme.borderColor} relative overflow-hidden transition-all duration-300 ${
        isDragging
          ? 'opacity-50 scale-[0.98] shadow-[0_30px_80px_rgba(0,0,0,0.5)]'
          : 'hover:shadow-[0_25px_70px_rgba(0,0,0,0.4)]'
      } ${isDragActive || isDragging ? 'select-none cursor-grabbing' : ''}`}
      style={{
        userSelect: isDragActive || isDragging ? 'none' : 'auto',
      }}
    >
      {/* Subtle gradient overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${colorScheme.gradientFrom}/5 ${colorScheme.gradientTo}/5 pointer-events-none`}
      />
      <div className="relative z-10">
        {/* Algorithm Header */}
        <div className="mb-6">
          <h2
            className={`text-2xl font-bold mb-2 bg-gradient-to-r ${colorScheme.gradientFrom} ${colorScheme.gradientTo} bg-clip-text text-transparent`}
          >
            {algorithmName}
          </h2>
          <div className="text-sm text-white/60">
            Algorithm Return: {algorithmReturn >= 0 ? '+' : ''}
            {algorithmReturn.toFixed(2)}% | Growth Rate: {growthRate >= 0 ? '+' : ''}
            {(growthRate * 100).toFixed(2)}% APY
          </div>
        </div>

        {/* Headline Metrics */}
        <div className="mb-6">
          <HeadlineMetrics
            data={algorithmData}
            primaryColor={colorScheme.primaryColor}
            gradientFrom={colorScheme.gradientFrom}
            gradientTo={colorScheme.gradientTo}
          />
        </div>

        {/* Chart and Metrics */}
        <div className="flex flex-col lg:flex-row gap-4" style={{ height: '700px' }}>
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
                description={fullData.description}
                onToggle={() => setIsMetricsPanelVisible(false)}
                enabledMetrics={enabledMetrics}
                onToggleMetric={handleToggleMetric}
                availableMetrics={availableMetrics}
                primaryColor={colorScheme.primaryColor}
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
                  xmlns="http://www.w3.org/2000/svg"
                  className="transition-transform duration-200 rotate-180"
                >
                  <path
                    d="M10 12L6 8L10 4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Show Metrics</span>
              </button>
            )}
            <BacktestChart
              data={algorithmData}
              growthRate={growthRate}
              hasShowMetricsButton={!isMetricsPanelVisible}
              availableTickers={availableTickers}
              selectedTicker={selectedTicker}
              onTickerChange={setSelectedTicker}
              algorithmColor={colorScheme.primaryColor}
              gradientFrom={colorScheme.gradientFrom}
              gradientTo={colorScheme.gradientTo}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
