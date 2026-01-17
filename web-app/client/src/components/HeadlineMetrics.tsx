import { generateGradientFromTailwind } from '@client/utils/colorUtils';
import { yearsBetween } from '@client/utils/dateUtils';
import { withCommasRounded } from '@client/utils/numberUtils';
import type { DescriptionMetrics, SimplePlot } from '@shared/types';

interface HeadlineMetricsProps {
  descriptionMetrics: DescriptionMetrics;
  gradientFrom?: string; // Tailwind gradient from class (e.g., "from-blue-400")
  gradientTo?: string; // Tailwind gradient to class (e.g., "to-cyan-400")
  isSideBySideMode?: boolean; // Whether we're in side-by-side comparison mode
  primaryColor?: string; // Primary color for the algorithm (hex format)
  selectedTickerPlot: SimplePlot;
}

export function HeadlineMetrics({
  descriptionMetrics,
  primaryColor = '#3b82f6',
  gradientFrom = 'from-blue-400',
  gradientTo = 'to-cyan-400',
  isSideBySideMode = false,
  selectedTickerPlot,
}: HeadlineMetricsProps) {
  // Calculate and format ticker return rate
  const balance = selectedTickerPlot.y.at(-1)!;
  const yearsBetweenStartAndEnd = yearsBetween(
    descriptionMetrics.timespan[1],
    descriptionMetrics.timespan[0],
  );
  const tickerReturn = balance - 100;
  const tickerGrowthRate = (Math.pow(balance / 100, 1 / yearsBetweenStartAndEnd) - 1) * 100;

  // Format ticker: in side-by-side mode show only growth rate (APY), otherwise show growth rate with APY label
  const tickerPerformanceFormatted = isSideBySideMode
    ? `${withCommasRounded(tickerGrowthRate)}% APY`
    : `${withCommasRounded(tickerReturn)}% (${withCommasRounded(tickerGrowthRate)}% APY)`;

  // Format algorithm: in side-by-side mode show only growth rate (APY), otherwise show return with growth rate (APY)
  const algorithmReturn = descriptionMetrics.algorithmReturn * 100;
  const algorithmGrowthRate = descriptionMetrics.growthRate * 100;

  const algorithmPerformanceFormatted = isSideBySideMode
    ? `${withCommasRounded(algorithmGrowthRate)}% APY`
    : `${withCommasRounded(algorithmReturn)}% (${withCommasRounded(algorithmGrowthRate)}% APY)`;

  // Format Sharpe ratio
  const algorithmSharpeRatio = descriptionMetrics.sharpeRatio;
  const algorithmSharpeRatioFormatted =
    algorithmSharpeRatio != null ? withCommasRounded(algorithmSharpeRatio) : 'N/A';

  // Determine color for Algorithm Growth Rate
  const getAlgorithmColor = () => {
    if (algorithmGrowthRate < 0) return 'text-red-500';
    if (algorithmGrowthRate >= tickerGrowthRate) return 'text-emerald-500';
    return 'text-white/90';
  };

  // Determine color for ticker Growth Rate
  const getTickerColor = () => {
    if (tickerGrowthRate >= 3) return 'text-emerald-500';
    if (tickerGrowthRate >= 0) return 'text-white/90';
    return 'text-red-500';
  };

  const getSharpeRatioColor = () => {
    if (algorithmSharpeRatio == null) return 'text-white/90';
    if (algorithmSharpeRatio >= 1) return 'text-emerald-500';
    if (algorithmSharpeRatio >= 0) return 'text-white-90';
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
        <div className="text-xs text-white/60 uppercase tracking-wider font-medium mb-2 text-center">
          {isSideBySideMode ? 'Algorithm Growth Rate' : 'Algorithm Return'}
        </div>
        <div className={`text-2xl font-bold tracking-tight ${getAlgorithmColor()} text-center`}>
          {(isSideBySideMode ? algorithmGrowthRate : algorithmReturn) >= 0 ? '+' : ''}
          {algorithmPerformanceFormatted}
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
        <div className="text-xs text-white/60 uppercase tracking-wider font-medium mb-2 text-center">
          {selectedTickerPlot.name} {isSideBySideMode ? 'Growth Rate' : 'Return'}
        </div>
        <div className={`text-2xl font-bold tracking-tight ${getTickerColor()} text-center`}>
          {tickerGrowthRate >= 0 ? '+' : ''}
          {tickerPerformanceFormatted}
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
        <div className="text-xs text-white/60 uppercase tracking-wider font-medium mb-2 text-center">
          Sharpe Ratio
        </div>
        <div className={`text-2xl font-bold tracking-tight ${getSharpeRatioColor()} text-center`}>
          {algorithmSharpeRatioFormatted}
        </div>
      </div>
    </div>
  );
}
