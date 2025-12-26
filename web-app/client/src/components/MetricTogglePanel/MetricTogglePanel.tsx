import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { MetricKey } from './metricUtils';
import { DEFAULT_METRIC_OPTIONS, METRIC_LABELS } from './metricUtils';

interface MetricTogglePanelProps {
  enabledMetrics: Record<MetricKey, boolean>;
  onToggle: (metric: MetricKey, enabled: boolean) => void;
  availableMetrics: Set<MetricKey>;
}

export function MetricTogglePanel({
  enabledMetrics,
  onToggle,
  availableMetrics,
}: MetricTogglePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allMetrics = Object.keys(METRIC_LABELS) as MetricKey[];
  const availableMetricsList = allMetrics.filter((metric) => availableMetrics.has(metric));

  const enabledCount = availableMetricsList.filter((metric) => enabledMetrics[metric]).length;
  const totalCount = availableMetricsList.length;

  // Calculate position to keep panel within viewport
  useEffect(() => {
    if (!isOpen) {
      // Clear style when closed
      requestAnimationFrame(() => setPanelStyle({}));
      return;
    }

    if (!buttonRef.current) return;

    // Use a double requestAnimationFrame to ensure DOM is fully updated
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!buttonRef.current) return;

        // Fallback: position relative to button if dropdown not ready yet
        if (!dropdownRef.current) {
          const buttonRect = buttonRef.current.getBoundingClientRect();
          setPanelStyle({
            top: `${buttonRect.bottom + 8}px`,
            left: `${buttonRect.left}px`,
          });
          return;
        }

        const buttonRect = buttonRef.current.getBoundingClientRect();
        const dropdown = dropdownRef.current;
        const viewportWidth = window.innerWidth;

        // Get actual dimensions, with fallback
        const dropdownWidth = dropdown.offsetWidth || 500;

        const newStyle: CSSProperties = {};

        // Position horizontally - align to button left edge, but ensure it doesn't go off screen
        const spaceOnRight = viewportWidth - buttonRect.left;
        if (spaceOnRight >= dropdownWidth + 8) {
          // Enough space to show aligned with button
          newStyle.left = `${buttonRect.left}px`;
          newStyle.right = 'auto';
        } else {
          // Not enough space on right, align to right edge of viewport with margin
          newStyle.right = '8px';
          newStyle.left = 'auto';
        }

        // Position vertically - always position below the button with proper spacing
        // Even if it goes off-screen, user can scroll to see it
        const spacing = 8;
        newStyle.top = `${buttonRect.bottom + spacing}px`;
        newStyle.bottom = 'auto';

        setPanelStyle(newStyle);
      });
    });
  }, [isOpen]);

  // Close panel when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    // Use a small delay to avoid closing immediately when opening
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 150);

    const updatePosition = () => {
      // Update position on resize or scroll
      requestAnimationFrame(() => {
        if (!buttonRef.current || !dropdownRef.current) return;

        const buttonRect = buttonRef.current.getBoundingClientRect();
        const dropdown = dropdownRef.current;
        const viewportWidth = window.innerWidth;
        const dropdownWidth = dropdown.offsetWidth || 500;

        const newStyle: CSSProperties = {};

        // Position horizontally
        const spaceOnRight = viewportWidth - buttonRect.left;
        if (spaceOnRight >= dropdownWidth + 8) {
          newStyle.left = `${buttonRect.left}px`;
          newStyle.right = 'auto';
        } else {
          newStyle.right = '8px';
          newStyle.left = 'auto';
        }

        // Position vertically - always position below with proper spacing
        // Even if it goes off-screen, user can scroll to see it
        const spacing = 8;
        newStyle.top = `${buttonRect.bottom + spacing}px`;
        newStyle.bottom = 'auto';

        setPanelStyle(newStyle);
      });
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        ref={buttonRef}
        className="flex items-center gap-3 px-4 py-3 bg-slate-900/60 border border-white/10 rounded-xl text-white/90 text-sm font-medium cursor-pointer transition-all duration-200 backdrop-blur-[10px] w-full justify-between hover:bg-slate-900/80 hover:border-white/20 hover:-translate-y-px"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        aria-label="Toggle metric visibility options"
      >
        <svg
          className={`text-blue-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2.25 4.5H15.75M2.25 9H15.75M2.25 13.5H15.75"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="4.5" cy="4.5" r="1.5" fill="currentColor" />
          <circle cx="4.5" cy="9" r="1.5" fill="currentColor" />
          <circle cx="4.5" cy="13.5" r="1.5" fill="currentColor" />
        </svg>
        <span className="flex-1 text-left">
          Metrics ({enabledCount}/{totalCount})
        </span>
        <svg
          className={`text-white/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed w-[90vw] sm:w-[500px] min-w-[350px] max-w-[calc(100vw-16px)] bg-slate-900/95 border border-white/10 rounded-xl p-5 backdrop-blur-[10px] shadow-[0_20px_60px_rgba(0,0,0,0.5)] z-[9999] animate-[slideDown_0.2s_ease-out] max-h-[80vh] overflow-y-auto"
            style={panelStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
              <h4 className="text-base font-semibold text-white/95 m-0">Display Metrics</h4>
              <div className="flex gap-2 flex-wrap w-full sm:w-auto">
                <button
                  className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/40 rounded-lg text-blue-400 text-xs font-medium cursor-pointer transition-all duration-200 backdrop-blur-[5px] hover:bg-blue-500/30 hover:border-blue-500/60 hover:-translate-y-px flex-1 sm:flex-initial"
                  onClick={() => {
                    availableMetricsList.forEach((metric) => {
                      onToggle(metric, true);
                    });
                  }}
                >
                  Enable All
                </button>
                <button
                  className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/40 rounded-lg text-blue-400 text-xs font-medium cursor-pointer transition-all duration-200 backdrop-blur-[5px] hover:bg-blue-500/30 hover:border-blue-500/60 hover:-translate-y-px flex-1 sm:flex-initial"
                  onClick={() => {
                    availableMetricsList.forEach((metric) => {
                      onToggle(metric, false);
                    });
                  }}
                >
                  Disable All
                </button>
                <button
                  className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/40 rounded-lg text-blue-400 text-xs font-medium cursor-pointer transition-all duration-200 backdrop-blur-[5px] hover:bg-blue-500/30 hover:border-blue-500/60 hover:-translate-y-px flex-1 sm:flex-initial"
                  onClick={() => {
                    availableMetricsList.forEach((metric) => {
                      onToggle(metric, DEFAULT_METRIC_OPTIONS[metric]);
                    });
                  }}
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
              {availableMetricsList.map((metric) => (
                <label
                  key={metric}
                  className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/5 select-none"
                >
                  <input
                    type="checkbox"
                    checked={enabledMetrics[metric]}
                    onChange={(e) => onToggle(metric, e.target.checked)}
                    className="w-[18px] h-[18px] cursor-pointer accent-blue-500 flex-shrink-0"
                  />
                  <span className="text-white/85 text-sm font-normal cursor-pointer hover:text-white/95">
                    {METRIC_LABELS[metric]}
                  </span>
                </label>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
