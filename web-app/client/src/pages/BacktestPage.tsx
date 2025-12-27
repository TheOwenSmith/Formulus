import { AlgorithmResultCard } from '@client/components/AlgorithmResultCard';
import '@client/styles/BacktestPage.css';
import { useEffect, useMemo, useState } from 'react';
import type { Graph } from '../types';

interface BacktestPageProps {
  data: Graph;
}

export function BacktestPage({ data }: BacktestPageProps) {
  // Get available tickers and default ticker
  const availableTickers = useMemo(() => {
    if (data.tickerPlots) {
      return Object.keys(data.tickerPlots);
    }
    // Legacy support
    if (data.tickerPlot) {
      return [data.tickerPlot.name];
    }
    return [];
  }, [data]);

  const defaultTicker = useMemo(() => {
    if (data.tickerPlots) {
      return Object.keys(data.tickerPlots)[0] || '';
    }
    return data.tickerPlot?.name || '';
  }, [data]);

  // Get algorithm plots - support both new (algorithmPlots) and legacy (algorithmPlot) formats
  const algorithmPlots = useMemo(() => {
    if (data.algorithmPlots) {
      return data.algorithmPlots;
    }
    // Legacy support
    if (data.algorithmPlot && data.algorithmName) {
      return { [data.algorithmName]: data.algorithmPlot };
    }
    return {};
  }, [data]);

  const algorithmNames = Object.keys(algorithmPlots);

  // Get display title
  const displayTitle = useMemo(() => {
    if (algorithmNames.length > 0) {
      return algorithmNames.length === 1 ? algorithmNames[0] : 'Algorithm Comparison';
    }
    return data.algorithmName || 'Backtesting Results';
  }, [algorithmNames, data.algorithmName]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 font-sans text-white">
      <div className="text-center mb-8 animate-[fadeInDown_0.8s_ease-out]">
        <h1 className="text-4xl font-bold mb-2 m-0 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent tracking-tight leading-tight pb-0.5">
          {displayTitle}
        </h1>
        <div className="text-base text-white/60 font-normal tracking-wider uppercase">
          Backtesting Performance Analysis
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto">
        {/* Render one card per algorithm */}
        {algorithmNames.map((algorithmName, index) => (
          <AlgorithmResultCard
            key={algorithmName}
            algorithmName={algorithmName}
            algorithmPlot={algorithmPlots[algorithmName]}
            fullData={data}
            availableTickers={availableTickers}
            defaultTicker={defaultTicker}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
