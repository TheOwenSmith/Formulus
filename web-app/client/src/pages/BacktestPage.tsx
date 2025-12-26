import { BacktestChart } from '@client/components/BacktestChart';
import { HeadlineMetrics } from '@client/components/HeadlineMetrics';
import {
  createMetricMap,
  DEFAULT_METRIC_OPTIONS,
  type MetricKey,
} from '@client/components/MetricTogglePanel/metricUtils';
import { PerformanceMetrics } from '@client/components/PerformanceMetrics';
import '@client/styles/BacktestPage.css';
import { useMemo, useState } from 'react';
import type { Graph } from '../types';

interface BacktestPageProps {
  data: Graph;
}

export function BacktestPage({ data }: BacktestPageProps) {
  const [isMetricsPanelVisible, setIsMetricsPanelVisible] = useState(true);

  // Lift metrics state to persist across panel visibility toggles
  const metricMap = useMemo(() => createMetricMap(data.description), [data.description]);
  const availableMetrics = useMemo(() => new Set(metricMap.keys()), [metricMap]);

  const [enabledMetrics, setEnabledMetrics] = useState<Record<MetricKey, boolean>>(() => {
    const initial: Record<MetricKey, boolean> = { ...DEFAULT_METRIC_OPTIONS };
    // Only enable metrics that are actually available in the data
    const tempMetricMap = createMetricMap(data.description);
    const availableSet = new Set(tempMetricMap.keys());
    for (const metric of availableSet) {
      initial[metric] = DEFAULT_METRIC_OPTIONS[metric];
    }
    return initial;
  });

  const handleToggleMetric = (metric: MetricKey, enabled: boolean) => {
    setEnabledMetrics((prev) => ({ ...prev, [metric]: enabled }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 font-sans text-white">
      <div className="text-center mb-8 animate-[fadeInDown_0.8s_ease-out]">
        <h1 className="text-4xl font-bold mb-2 m-0 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent tracking-tight leading-tight pb-0.5">
          {data.algorithmName}
        </h1>
        <div className="text-base text-white/60 font-normal tracking-wider uppercase">
          Backtesting Performance Analysis
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto">
        {/* Top headline metrics */}
        <HeadlineMetrics data={data} />

        {/* Main content area: horizontal split */}
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
                description={data.description}
                onToggle={() => setIsMetricsPanelVisible(false)}
                enabledMetrics={enabledMetrics}
                onToggleMetric={handleToggleMetric}
                availableMetrics={availableMetrics}
              />
            )}
          </div>

          {/* Main graph (right) */}
          <div className="flex-1 w-full min-w-0 relative" style={{ height: '100%' }}>
            {!isMetricsPanelVisible && (
              <button
                onClick={() => setIsMetricsPanelVisible(true)}
                className="absolute top-4 left-4 z-10 bg-slate-800/60 border border-white/10 text-white/90 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 backdrop-blur-[10px] hover:bg-slate-800/80 hover:border-white/20 hover:-translate-y-px flex items-center gap-2 shadow-lg"
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
              data={data}
              growthRate={data.growthRate}
              hasShowMetricsButton={!isMetricsPanelVisible}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
