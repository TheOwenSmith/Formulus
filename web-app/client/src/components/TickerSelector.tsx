import { useEffect, useRef, useState } from 'react';

interface TickerSelectorProps {
  availableTickers: string[];
  selectedTicker: string;
  onTickerChange: (ticker: string) => void;
}

export function TickerSelector({
  availableTickers,
  selectedTicker,
  onTickerChange,
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
          xmlns="http://www.w3.org/2000/svg"
          className={`text-white/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path
            d="M2.5 3.75L5 6.25L7.5 3.75"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
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
                  ? 'bg-blue-500/30 text-white border-l-2 border-blue-500'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              {ticker}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
