import type { Graph } from '@client/types';
import { withCommasRounded } from '@client/utils/numberUtils';
import { generateGradientFromTailwind } from '@client/utils/colorUtils';

interface HeadlineMetricsProps {
  data: Graph;
  primaryColor?: string; // Primary color for the algorithm (hex format)
  gradientFrom?: string; // Tailwind gradient from class (e.g., "from-blue-400")
  gradientTo?: string; // Tailwind gradient to class (e.g., "to-cyan-400")
}

export function HeadlineMetrics({
  data,
  primaryColor = '#3b82f6',
  gradientFrom = 'from-blue-400',
  gradientTo = 'to-cyan-400',
}: HeadlineMetricsProps) {
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

  // Convert hex to rgba for border styling
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-[fadeInDown_0.8s_ease-out]">
      <div
        className="stat-card bg-slate-900/60 rounded-xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] transition-all duration-300 relative overflow-hidden hover:-translate-y-1 group"
        style={{ borderColor: hexToRgba(primaryColor, 0.2) }}
      >
        {/* Custom gradient bar that replaces ::before pseudo-element */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-xl"
          style={{
            background: generateGradientFromTailwind(gradientFrom, gradientTo),
          }}
        />
        <div className="text-xs text-white/60 uppercase tracking-wider font-medium mb-2">
          Algorithm Growth Rate
        </div>
        <div className={`text-2xl font-bold tracking-tight ${getAlgorithmColor()}`}>
          {algorithmGrowthRate >= 0 ? '+' : ''}
          {growthRateFormatted}
        </div>
      </div>

      <div className="stat-card bg-slate-900/60 rounded-xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] transition-all duration-300 relative overflow-hidden hover:-translate-y-1 group">
        {/* Custom gradient bar for ticker card */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-xl"
          style={{
            background: generateGradientFromTailwind(gradientFrom, gradientTo),
          }}
        />
        <div className="text-xs text-white/60 uppercase tracking-wider font-medium mb-2">
          {data.tickerPlot.name} Growth Rate
        </div>
        <div className={`text-2xl font-bold tracking-tight ${getTickerColor()}`}>
          {tickerReturn >= 0 ? '+' : ''}
          {withCommasRounded(tickerReturn)}% APY
        </div>
      </div>

      <div
        className="stat-card bg-slate-900/60 rounded-xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] transition-all duration-300 relative overflow-hidden border hover:-translate-y-1 group"
        style={{ borderColor: hexToRgba(primaryColor, 0.2) }}
      >
        {/* Custom gradient bar for Sharpe ratio card */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-xl"
          style={{
            background: generateGradientFromTailwind(gradientFrom, gradientTo),
          }}
        />
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
