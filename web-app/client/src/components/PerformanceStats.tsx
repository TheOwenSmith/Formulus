import type { Graph } from '../types';

interface PerformanceStatsProps {
  data: Graph;
}

export function PerformanceStats({ data }: PerformanceStatsProps) {
  // Calculate performance metrics
  const initialTickerValue = data.tickerPlot.y[0];
  const finalTickerValue = data.tickerPlot.y[data.tickerPlot.y.length - 1];
  const tickerReturn = ((finalTickerValue - initialTickerValue) / initialTickerValue) * 100;

  const initialAlgorithmValue = data.algorithmPlot.y[0];
  const finalAlgorithmValue = data.algorithmPlot.y[data.algorithmPlot.y.length - 1];
  const algorithmReturn =
    ((finalAlgorithmValue - initialAlgorithmValue) / initialAlgorithmValue) * 100;

  const outperformance = algorithmReturn - tickerReturn;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6 mb-8 animate-[fadeInUp_0.8s_ease-out_0.4s_both]">
      <div className="stat-card stat-card-primary bg-slate-900/60 rounded-xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] transition-all duration-300 relative overflow-hidden border border-emerald-500/20 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.1)]">
        <div className="text-sm text-white/60 uppercase tracking-wider font-medium mb-3">
          Algorithm Return
        </div>
        <div
          className={`text-3xl font-bold mb-2 tracking-tight ${algorithmReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
        >
          {algorithmReturn >= 0 ? '+' : ''}
          {algorithmReturn.toFixed(2)}%
        </div>
        <div className="text-base text-white/80 font-medium">
          $
          {finalAlgorithmValue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      </div>

      <div className="stat-card bg-slate-900/60 rounded-xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] transition-all duration-300 relative overflow-hidden hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.1)]">
        <div className="text-sm text-white/60 uppercase tracking-wider font-medium mb-3">
          {data.tickerPlot.name} Return
        </div>
        <div
          className={`text-3xl font-bold mb-2 tracking-tight ${tickerReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
        >
          {tickerReturn >= 0 ? '+' : ''}
          {tickerReturn.toFixed(2)}%
        </div>
        <div className="text-base text-white/80 font-medium">
          $
          {finalTickerValue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      </div>

      <div className="stat-card stat-card-accent bg-slate-900/60 rounded-xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] transition-all duration-300 relative overflow-hidden border border-blue-500/20 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.1)]">
        <div className="text-sm text-white/60 uppercase tracking-wider font-medium mb-3">
          Outperformance
        </div>
        <div
          className={`text-3xl font-bold mb-2 tracking-tight ${outperformance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
        >
          {outperformance >= 0 ? '+' : ''}
          {outperformance.toFixed(2)}%
        </div>
        <div className="text-sm text-white/50 mt-2">
          {outperformance >= 0 ? 'Algorithm outperformed' : 'Algorithm underperformed'}{' '}
          benchmark
        </div>
      </div>
    </div>
  );
}

