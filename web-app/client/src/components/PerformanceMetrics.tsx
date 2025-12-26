import { useMemo } from 'react';
import { MetricTogglePanel } from './MetricTogglePanel/MetricTogglePanel';
import { createMetricMap, type MetricKey } from './MetricTogglePanel/metricUtils';

interface PerformanceMetricsProps {
  description: string[];
  onToggle?: () => void;
  enabledMetrics: Record<MetricKey, boolean>;
  onToggleMetric: (metric: MetricKey, enabled: boolean) => void;
  availableMetrics: Set<MetricKey>;
}

export function PerformanceMetrics({
  description,
  onToggle,
  enabledMetrics,
  onToggleMetric,
  availableMetrics,
}: PerformanceMetricsProps) {
  // Metric toggle state is now managed by parent
  const metricMap = useMemo(() => createMetricMap(description), [description]);

  // Filter displayed metrics based on toggle state
  const displayedMetrics = useMemo(() => {
    return description.filter((desc) => {
      // Try to identify the metric
      for (const [metricKey, metricDesc] of metricMap.entries()) {
        if (desc === metricDesc) {
          return enabledMetrics[metricKey];
        }
      }
      // If we can't identify it, show it by default (fallback)
      return true;
    });
  }, [description, metricMap, enabledMetrics]);

  return (
    <div className="bg-slate-900/60 rounded-xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] h-full flex flex-col relative">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold m-0 text-white/90 tracking-tight">
          Performance Metrics
        </h3>
        {onToggle && (
          <button
            onClick={onToggle}
            className="bg-slate-800/60 border border-white/10 text-white/90 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 backdrop-blur-[10px] hover:bg-slate-800/80 hover:border-white/20 hover:-translate-y-px flex items-center gap-2"
            aria-label="Hide metrics panel"
            title="Hide Metrics"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 12L6 8L10 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
      <div className="mb-6">
        <MetricTogglePanel
          enabledMetrics={enabledMetrics}
          onToggle={onToggleMetric}
          availableMetrics={availableMetrics}
        />
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {displayedMetrics.length > 0 ? (
          <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-2">
            {displayedMetrics.map((metric, index) => (
              <div
                key={index}
                className="py-2 px-4 bg-white/3 rounded-lg border border-white/5 text-sm text-white/80 transition-all duration-200 hover:bg-white/5 hover:border-white/10 flex-shrink-0"
              >
                {metric}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-white/50 text-sm">
            No metrics selected. Use the toggle panel above to enable metrics.
          </div>
        )}
      </div>
    </div>
  );
}
