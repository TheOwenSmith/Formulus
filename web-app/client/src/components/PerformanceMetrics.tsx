import { MetricTogglePanel } from '@client/MetricTogglePanel';
import { createMetricMap, DEFAULT_METRIC_OPTIONS, type MetricKey } from '@client/metricUtils';
import { useMemo, useState } from 'react';

interface PerformanceMetricsProps {
  description: string[];
}

export function PerformanceMetrics({ description }: PerformanceMetricsProps) {
  // Metric toggle state
  const metricMap = useMemo(() => createMetricMap(description), [description]);
  const availableMetrics = useMemo(() => new Set(metricMap.keys()), [metricMap]);

  const [enabledMetrics, setEnabledMetrics] = useState<Record<MetricKey, boolean>>(() => {
    const initial: Record<MetricKey, boolean> = { ...DEFAULT_METRIC_OPTIONS };
    // Only enable metrics that are actually available in the data
    const tempMetricMap = createMetricMap(description);
    const availableSet = new Set(tempMetricMap.keys());
    for (const metric of availableSet) {
      initial[metric] = DEFAULT_METRIC_OPTIONS[metric];
    }
    return initial;
  });

  const handleToggleMetric = (metric: MetricKey, enabled: boolean) => {
    setEnabledMetrics((prev) => ({ ...prev, [metric]: enabled }));
  };

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
    <div className="bg-slate-900/60 rounded-xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] animate-[fadeInUp_0.8s_ease-out_0.6s_both]">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h3 className="text-xl font-semibold m-0 text-white/90 tracking-tight">
          Performance Metrics
        </h3>
        <MetricTogglePanel
          enabledMetrics={enabledMetrics}
          onToggle={handleToggleMetric}
          availableMetrics={availableMetrics}
        />
      </div>
      {displayedMetrics.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
          {displayedMetrics.map((metric, index) => (
            <div
              key={index}
              className="py-3 px-4 bg-white/3 rounded-lg border border-white/5 text-sm text-white/80 transition-all duration-200 hover:bg-white/5 hover:border-white/10 hover:translate-x-1"
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
  );
}
