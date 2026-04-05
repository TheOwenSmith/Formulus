import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const TOOLTIP_OFFSET = 12;
const TOOLTIP_DELAY_MS = 400;
const TOOLTIP_STYLE =
  'pointer-events-none z-50 px-3 py-2 rounded-xl text-sm text-white/90 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] bg-slate-900/95 backdrop-blur-[10px] border border-white/10 max-w-[min(280px,90vw)] w-max';

type TooltipAnchor = 'cursor' | 'above';

/**
 * Tooltip that matches the project's dark glass style. Appears after a short delay.
 * - cursor: at cursor position (closes when cursor moves).
 * - above: above the trigger (avoids overlapping nearby content; closes when cursor moves).
 */
export function Tooltip({
  content,
  children,
  className = '',
  anchor = 'cursor',
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  anchor?: TooltipAnchor;
}) {
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [aboveVisible, setAboveVisible] = useState(false);
  const [aboveRect, setAboveRect] = useState<DOMRect | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPositionRef = useRef({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement | null>(null);

  const visible = anchor === 'above' ? aboveVisible : cursorPos !== null;

  useEffect(() => {
    return () => {
      if (delayRef.current) clearTimeout(delayRef.current);
    };
  }, []);

  function hide() {
    if (delayRef.current) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
    }
    setCursorPos(null);
    setAboveVisible(false);
    setAboveRect(null);
  }

  return (
    <>
      <div
        ref={triggerRef}
        className={`relative ${className}`}
        onMouseEnter={(e) => {
          pendingPositionRef.current = { x: e.clientX, y: e.clientY };
          delayRef.current = setTimeout(() => {
            delayRef.current = null;
            if (anchor === 'above') {
              const rect = triggerRef.current?.getBoundingClientRect();
              setAboveRect(rect ?? null);
              setAboveVisible(true);
            } else {
              setCursorPos({ ...pendingPositionRef.current });
            }
          }, TOOLTIP_DELAY_MS);
        }}
        onMouseMove={(e) => {
          if (visible) {
            hide();
          } else {
            pendingPositionRef.current = { x: e.clientX, y: e.clientY };
          }
        }}
        onMouseLeave={hide}
      >
        {children}
      </div>
      {anchor === 'above' &&
        aboveVisible &&
        aboveRect &&
        createPortal(
          <div
            className={`fixed ${TOOLTIP_STYLE}`}
            style={{
              left: aboveRect.left,
              width: aboveRect.width,
              maxWidth: aboveRect.width,
              bottom: window.innerHeight - aboveRect.top + 8,
            }}
            role="tooltip"
          >
            {content}
          </div>,
          document.body,
        )}
      {anchor === 'cursor' &&
        cursorPos &&
        createPortal(
          <div
            className={`fixed ${TOOLTIP_STYLE}`}
            style={{ left: cursorPos.x + TOOLTIP_OFFSET, top: cursorPos.y + TOOLTIP_OFFSET }}
            role="tooltip"
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
