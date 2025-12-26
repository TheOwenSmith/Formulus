import { BacktestChart } from '@client/components/BacktestChart';
import { PerformanceMetrics } from '@client/components/PerformanceMetrics';
import { PerformanceStats } from '@client/components/PerformanceStats';
import '@client/styles/BacktestPage.css';
import type { Graph } from '../types';

interface BacktestPageProps {
  data: Graph;
}

export function BacktestPage({ data }: BacktestPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 font-sans text-white">
      <div className="text-center mb-12 animate-[fadeInDown_0.8s_ease-out]">
        <h1 className="text-4xl font-bold mb-2 m-0 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent tracking-tight leading-tight pb-0.5">
          {data.algorithmName}
        </h1>
        <div className="text-base text-white/60 font-normal tracking-wider uppercase">
          Backtesting Performance Analysis
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto">
        <BacktestChart data={data} growthRate={data.growthRate} />

        <PerformanceStats data={data} />

        <PerformanceMetrics description={data.description} />
      </div>
    </div>
  );
}
