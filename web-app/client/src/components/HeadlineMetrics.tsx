import type { Graph } from '@client/types';
import { withCommasRounded } from '@client/utils/numberUtils';

interface HeadlineMetricsProps {
  data: Graph;
}

export function HeadlineMetrics({ data }: HeadlineMetricsProps) {
  // Calculate performance metrics
  const initialTickerValue = data.tickerPlot.y[0];
  const finalTickerValue = data.tickerPlot.y[data.tickerPlot.y.length - 1];
  const tickerReturn = ((finalTickerValue - initialTickerValue) / initialTickerValue) * 100;

  const initialAlgorithmValue = data.algorithmPlot.y[0];
  const finalAlgorithmValue = data.algorithmPlot.y[data.algorithmPlot.y.length - 1];

  // Calculate algorithm return from plot data for outperformance calculation
  const algorithmReturn =
    ((finalAlgorithmValue - initialAlgorithmValue) / initialAlgorithmValue) * 100;

  // Format growth rate with APY
  const growthRateFormatted = `${withCommasRounded(data.growthRate * 100)}% APY`;

  // Format Sharpe ratio
  const sharpeRatio = data.sharpeRatio;
  const sharpeRatioFormatted = sharpeRatio != null ? withCommasRounded(sharpeRatio) : 'N/A';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-[fadeInDown_0.8s_ease-out]">
      <div className="stat-card stat-card-primary bg-slate-900/60 rounded-xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] transition-all duration-300 relative overflow-hidden border border-emerald-500/20">
        <div className="text-xs text-white/60 uppercase tracking-wider font-medium mb-2">
          Growth Rate
        </div>
        <div
          className={`text-2xl font-bold tracking-tight ${algorithmReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
        >
          {algorithmReturn >= 0 ? '+' : ''}
          {growthRateFormatted}
        </div>
      </div>

      <div className="stat-card bg-slate-900/60 rounded-xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] transition-all duration-300 relative overflow-hidden">
        <div className="text-xs text-white/60 uppercase tracking-wider font-medium mb-2">
          {data.tickerPlot.name} Growth Rate
        </div>
        <div
          className={`text-2xl font-bold tracking-tight ${tickerReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
        >
          {tickerReturn >= 0 ? '+' : ''}
          {withCommasRounded(tickerReturn)}% APY
        </div>
      </div>

      <div className="stat-card stat-card-accent bg-slate-900/60 rounded-xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] transition-all duration-300 relative overflow-hidden border border-blue-500/20">
        <div className="text-xs text-white/60 uppercase tracking-wider font-medium mb-2">
          Sharpe Ratio
        </div>
        <div
          className={`text-2xl font-bold tracking-tight ${
            sharpeRatio != null && sharpeRatio >= 1
              ? 'text-emerald-500'
              : sharpeRatio != null && sharpeRatio >= 0
                ? 'text-yellow-500'
                : sharpeRatio != null
                  ? 'text-red-500'
                  : 'text-white/60'
          }`}
        >
          {sharpeRatioFormatted}
        </div>
      </div>
    </div>
  );
}

