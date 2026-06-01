import { ARROW_LEFT, STROKE_PROPERTIES, SVG_NAMESPACE } from '@client/icons/index';
import type { DescriptionMetrics } from '@shared/constants/trading';
import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { MetricTogglePanel } from './MetricTogglePanel/MetricTogglePanel';
import {
  DESCRIPTION_METRIC_LABELS,
  DESCRIPTION_METRIC_TO_STRING,
  DESCRIPTION_METRICS_ORDER,
  type DescriptionMetricVisbility,
  type MetricKey,
} from './MetricTogglePanel/metricUtils';

interface PerformanceMetricsProps {
  descriptionMetrics: DescriptionMetrics;
  hideToggleButton?: boolean; // Hide the internal toggle button (useful for side-by-side mode)
  metricVisibility: DescriptionMetricVisbility;
  onToggle?: () => void;
  primaryColor?: string; // Primary color for the algorithm (hex format)
  primaryColorLight?: string; // Light version of primary color for text (hex format)
  setMetricVisibility: Dispatch<SetStateAction<DescriptionMetricVisbility>>;
}

export function PerformanceMetrics({
  descriptionMetrics,
  hideToggleButton = false,
  metricVisibility,
  onToggle,
  primaryColor = '#3b82f6',
  primaryColorLight,
  setMetricVisibility,
}: PerformanceMetricsProps) {
  // Memoize enabled metrics to avoid recalculating on every render
  const enabledMetrics: MetricKey[] = useMemo(
    () => DESCRIPTION_METRICS_ORDER.filter((metric) => metricVisibility[metric]),
    [metricVisibility],
  );

  return (
    <div className="bg-slate-900/60 rounded-xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] h-full flex flex-col relative">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold m-0 text-white/90 tracking-tight">
          Performance Metrics
        </h3>
        {onToggle && !hideToggleButton && (
          <button
            onClick={onToggle}
            className="bg-slate-800/60 border border-white/10 text-white/90 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 backdrop-blur-[10px] hover:bg-slate-800/80 hover:border-white/20 hover:-translate-y-px flex items-center gap-2"
            aria-label="Hide metrics panel"
            title="Hide Metrics"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns={SVG_NAMESPACE}>
              <path d={ARROW_LEFT} {...STROKE_PROPERTIES} />
            </svg>
          </button>
        )}
      </div>
      <div className="mb-6">
        <MetricTogglePanel
          metricVisibility={metricVisibility}
          primaryColor={primaryColor}
          primaryColorLight={primaryColorLight}
          setMetricVisibility={setMetricVisibility}
        />
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {enabledMetrics.length > 0 ? (
          <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-2">
            {enabledMetrics.map((metric: MetricKey, index) => {
              const label = DESCRIPTION_METRIC_LABELS[metric];
              const descriptionMetricToStringFn = DESCRIPTION_METRIC_TO_STRING[metric] as (
                descriptionMetric: DescriptionMetrics[MetricKey],
              ) => string;
              const value = descriptionMetricToStringFn(descriptionMetrics[metric]);

              return (
                <div
                  key={index}
                  className="py-2.5 px-4 bg-white/4 rounded-lg border border-white/8 text-sm text-white/85 transition-all duration-200 hover:bg-white/6 hover:border-white/12 flex-shrink-0"
                >
                  <div>
                    <span className="text-white/60">{label} </span>
                    <span className="text-white/90 font-medium">{value}</span>
                  </div>
                </div>
              );
            })}
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
