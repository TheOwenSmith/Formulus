import { generateGradientFromTailwind } from '@client/utils/colorUtils';
import { yearsBetween } from '@client/utils/dateUtils';
import { withCommasRounded } from '@client/utils/numberUtils';
import type { DescriptionMetrics, SimplePlot } from '@shared/worker';
import { useMemo } from 'react';

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
  // Memoize calculations to avoid recalculating on every render
  const calculations = useMemo(() => {
    const balance = selectedTickerPlot.y.at(-1)!;
    const yearsBetweenStartAndEnd = yearsBetween(
      descriptionMetrics.timespan[1],
      descriptionMetrics.timespan[0],
    );
    const tickerReturn = balance - 100;
    const tickerGrowthRate = (Math.pow(balance / 100, 1 / yearsBetweenStartAndEnd) - 1) * 100;
    const algorithmReturn = descriptionMetrics.algorithmReturn * 100;
    const algorithmGrowthRate = descriptionMetrics.growthRate * 100;
    const algorithmSharpeRatio = descriptionMetrics.sharpeRatio;

    return {
      algorithmGrowthRate,
      algorithmReturn,
      algorithmSharpeRatio,
      balance,
      tickerGrowthRate,
      tickerReturn,
      yearsBetweenStartAndEnd,
    };
  }, [
    selectedTickerPlot.y,
    descriptionMetrics.timespan,
    descriptionMetrics.algorithmReturn,
    descriptionMetrics.growthRate,
    descriptionMetrics.sharpeRatio,
  ]);

  // Memoize formatted strings
  const formattedStrings = useMemo(() => {
    const tickerPerformanceFormatted = isSideBySideMode
      ? `${withCommasRounded(calculations.tickerGrowthRate)}% APY`
      : `${withCommasRounded(calculations.tickerReturn)}% (${withCommasRounded(calculations.tickerGrowthRate)}% APY)`;

    const algorithmPerformanceFormatted = isSideBySideMode
      ? `${withCommasRounded(calculations.algorithmGrowthRate)}% APY`
      : `${withCommasRounded(calculations.algorithmReturn)}% (${withCommasRounded(calculations.algorithmGrowthRate)}% APY)`;

    const algorithmSharpeRatioFormatted =
      calculations.algorithmSharpeRatio != null
        ? withCommasRounded(calculations.algorithmSharpeRatio)
        : 'N/A';

    return {
      tickerPerformanceFormatted,
      algorithmPerformanceFormatted,
      algorithmSharpeRatioFormatted,
    };
  }, [isSideBySideMode, calculations]);

  // Memoize color classes
  const colorClasses = useMemo(() => {
    const getAlgorithmColor = () => {
      if (calculations.algorithmGrowthRate < 0) return 'text-red-500';
      if (calculations.algorithmGrowthRate >= calculations.tickerGrowthRate)
        return 'text-emerald-500';
      return 'text-white/90';
    };

    const getTickerColor = () => {
      if (calculations.tickerGrowthRate >= 3) return 'text-emerald-500';
      if (calculations.tickerGrowthRate >= 0) return 'text-white/90';
      return 'text-red-500';
    };

    const getSharpeRatioColor = () => {
      if (calculations.algorithmSharpeRatio == null) return 'text-white/90';
      if (calculations.algorithmSharpeRatio >= 1) return 'text-emerald-500';
      if (calculations.algorithmSharpeRatio >= 0) return 'text-white-90';
      return 'text-red-500';
    };

    return {
      algorithmColor: getAlgorithmColor(),
      tickerColor: getTickerColor(),
      sharpeRatioColor: getSharpeRatioColor(),
    };
  }, [calculations]);

  // Memoize gradient and border color
  const gradient = useMemo(
    () => generateGradientFromTailwind(gradientFrom, gradientTo),
    [gradientFrom, gradientTo],
  );

  const borderColor = useMemo(() => {
    const r = parseInt(primaryColor.slice(1, 3), 16);
    const g = parseInt(primaryColor.slice(3, 5), 16);
    const b = parseInt(primaryColor.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.2)`;
  }, [primaryColor]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-[fadeInDown_0.8s_ease-out]">
      <div
        className="stat-card bg-slate-900/60 rounded-xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] transition-all duration-300 relative overflow-hidden hover:-translate-y-1 group"
        style={{ borderColor }}
      >
        {/* Custom gradient bar that replaces ::before pseudo-element */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-xl"
          style={{ background: gradient }}
        />
        <div className="text-xs text-white/60 uppercase tracking-wider font-medium mb-2 text-center">
          {isSideBySideMode ? 'Algorithm Growth Rate' : 'Algorithm Return'}
        </div>
        <div
          className={`text-2xl font-bold tracking-tight ${colorClasses.algorithmColor} text-center`}
        >
          {(isSideBySideMode ? calculations.algorithmGrowthRate : calculations.algorithmReturn) >= 0
            ? '+'
            : ''}
          {formattedStrings.algorithmPerformanceFormatted}
        </div>
      </div>

      <div className="stat-card bg-slate-900/60 rounded-xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] transition-all duration-300 relative overflow-hidden hover:-translate-y-1 group">
        {/* Custom gradient bar for ticker card */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-xl"
          style={{ background: gradient }}
        />
        <div className="text-xs text-white/60 uppercase tracking-wider font-medium mb-2 text-center">
          {selectedTickerPlot.name} {isSideBySideMode ? 'Growth Rate' : 'Return'}
        </div>
        <div
          className={`text-2xl font-bold tracking-tight ${colorClasses.tickerColor} text-center`}
        >
          {calculations.tickerGrowthRate >= 0 ? '+' : ''}
          {formattedStrings.tickerPerformanceFormatted}
        </div>
      </div>

      <div
        className="stat-card bg-slate-900/60 rounded-xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] transition-all duration-300 relative overflow-hidden border hover:-translate-y-1 group"
        style={{ borderColor }}
      >
        {/* Custom gradient bar for Sharpe ratio card */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-xl"
          style={{ background: gradient }}
        />
        <div className="text-xs text-white/60 uppercase tracking-wider font-medium mb-2 text-center">
          Sharpe Ratio
        </div>
        <div
          className={`text-2xl font-bold tracking-tight ${colorClasses.sharpeRatioColor} text-center`}
        >
          {formattedStrings.algorithmSharpeRatioFormatted}
        </div>
      </div>
    </div>
  );
}
