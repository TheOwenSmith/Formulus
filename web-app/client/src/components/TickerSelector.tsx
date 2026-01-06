import { ARROW_DOWN_SMALL, STROKE_PROPERTIES_SMALL, SVG_NAMESPACE } from '@client/icons/index';
import type { Ticker } from '@shared/types';
import { useEffect, useRef, useState } from 'react';

interface TickerSelectorProps {
  availableTickers: Ticker[];
  selectedTicker: string;
  onTickerChange: (ticker: Ticker) => void;
  algorithmColor?: string; // Primary color for the algorithm (hex format)
}

export function TickerSelector({
  availableTickers,
  selectedTicker,
  onTickerChange,
  algorithmColor = '#3b82f6', // Default to blue
}: TickerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-white/95 text-[13px] font-medium cursor-pointer transition-all duration-200 hover:text-white focus:outline-none"
        style={{ fontFamily: 'inherit' }}
      >
        <span>{selectedTicker}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          xmlns={SVG_NAMESPACE}
          className={`text-white/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d={ARROW_DOWN_SMALL} {...STROKE_PROPERTIES_SMALL} />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-slate-800/95 border border-white/10 rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur-[10px] overflow-hidden z-50 min-w-[80px]">
          {availableTickers.map((ticker) => (
            <button
              key={ticker}
              type="button"
              onClick={() => {
                onTickerChange(ticker);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs font-medium transition-all duration-150 ${
                ticker === selectedTicker
                  ? 'text-white border-l-2'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
              style={
                ticker === selectedTicker
                  ? {
                      backgroundColor: `${algorithmColor}30`,
                      borderLeftColor: algorithmColor,
                    }
                  : undefined
              }
            >
              {ticker}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
