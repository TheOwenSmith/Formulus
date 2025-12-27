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

  // Format growth rate with APY
  const growthRateFormatted = `${withCommasRounded(data.growthRate * 100)}% APY`;

  // Calculate algorithm growth rate as percentage for color logic
  const algorithmGrowthRate = data.growthRate * 100;

  // Format Sharpe ratio
  const sharpeRatio = data.sharpeRatio;
  const sharpeRatioFormatted = sharpeRatio != null ? withCommasRounded(sharpeRatio) : 'N/A';

  // Determine color for Algorithm Growth Rate
  const getAlgorithmColor = () => {
    if (algorithmGrowthRate < 0) return 'text-red-500';
    if (algorithmGrowthRate >= tickerReturn) return 'text-emerald-500';
    return 'text-white/90';
  };

  // Determine color for SPY Growth Rate
  const getTickerColor = () => {
    if (tickerReturn >= 3) return 'text-emerald-500';
    if (tickerReturn >= 0) return 'text-white/90';
    return 'text-red-500';
  };

  const getSharpeRatioColor = () => {
    if (sharpeRatio == null) return 'text-white/90';
    if (sharpeRatio >= 1) return 'text-emerald-500';
    if (sharpeRatio >= 0) return 'text-white-90';
    return 'text-red-500';
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-[fadeInDown_0.8s_ease-out]">
      <div className="stat-card stat-card-primary bg-slate-900/60 rounded-xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] transition-all duration-300 relative overflow-hidden border border-emerald-500/20 hover:-translate-y-1">
        <div className="text-xs text-white/60 uppercase tracking-wider font-medium mb-2">
          Algorithm Growth Rate
        </div>
        <div className={`text-2xl font-bold tracking-tight ${getAlgorithmColor()}`}>
          {algorithmGrowthRate >= 0 ? '+' : ''}
          {growthRateFormatted}
        </div>
      </div>

      <div className="stat-card bg-slate-900/60 rounded-xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] transition-all duration-300 relative overflow-hidden hover:-translate-y-1">
        <div className="text-xs text-white/60 uppercase tracking-wider font-medium mb-2">
          {data.tickerPlot.name} Growth Rate
        </div>
        <div className={`text-2xl font-bold tracking-tight ${getTickerColor()}`}>
          {tickerReturn >= 0 ? '+' : ''}
          {withCommasRounded(tickerReturn)}% APY
        </div>
      </div>

      <div className="stat-card stat-card-accent bg-slate-900/60 rounded-xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] transition-all duration-300 relative overflow-hidden border border-blue-500/20 hover:-translate-y-1">
        <div className="text-xs text-white/60 uppercase tracking-wider font-medium mb-2">
          Sharpe Ratio
        </div>
        <div className={`text-2xl font-bold tracking-tight ${getSharpeRatioColor()}`}>
          {sharpeRatioFormatted}
        </div>
      </div>
    </div>
  );
}
