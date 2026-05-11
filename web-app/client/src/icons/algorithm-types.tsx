/**
 * Algorithm type icons for the create-algorithm onboarding workflow.
 * Refined SVGs: consistent stroke, clean geometry, scalable.
 */

const VIEW_BOX = '0 0 48 48';
const DEFAULT_CLASS = 'w-10 h-10';

export function ExamplesIcon({ className = DEFAULT_CLASS }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox={VIEW_BOX}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Top-left card */}
      <rect x="5" y="5" width="17" height="17" rx="3" />
      <line x1="9" y1="10.5" x2="18" y2="10.5" strokeWidth={1.5} />
      <line x1="9" y1="14.5" x2="14.5" y2="14.5" strokeWidth={1.5} />
      {/* Top-right card */}
      <rect x="26" y="5" width="17" height="17" rx="3" />
      <line x1="30" y1="10.5" x2="39" y2="10.5" strokeWidth={1.5} />
      <line x1="30" y1="14.5" x2="35.5" y2="14.5" strokeWidth={1.5} />
      {/* Bottom-left card */}
      <rect x="5" y="26" width="17" height="17" rx="3" />
      <line x1="9" y1="31.5" x2="18" y2="31.5" strokeWidth={1.5} />
      <line x1="9" y1="35.5" x2="14.5" y2="35.5" strokeWidth={1.5} />
      {/* Bottom-right card - highlighted with fill dot */}
      <rect x="26" y="26" width="17" height="17" rx="3" />
      <line x1="30" y1="31.5" x2="39" y2="31.5" strokeWidth={1.5} />
      <line x1="30" y1="35.5" x2="35.5" y2="35.5" strokeWidth={1.5} />
    </svg>
  );
}

export function NormalIcon({ className = DEFAULT_CLASS }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox={VIEW_BOX}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Central node */}
      <circle cx="24" cy="24" r="4.5" />
      {/* Outer nodes */}
      <circle cx="8" cy="12" r="3" />
      <circle cx="40" cy="12" r="3" />
      <circle cx="8" cy="36" r="3" />
      <circle cx="40" cy="36" r="3" />
      {/* Connections */}
      <line x1="11.5" y1="14" x2="20" y2="21" />
      <line x1="36.5" y1="14" x2="28" y2="21" />
      <line x1="11.5" y1="34" x2="20" y2="27" />
      <line x1="36.5" y1="34" x2="28" y2="27" />
      {/* Outer node emphasis (filled dots) */}
      <circle cx="8" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="40" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="8" cy="36" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="40" cy="36" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SimpleIcon({ className = DEFAULT_CLASS }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox={VIEW_BOX}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* X-axis */}
      <line x1="4" y1="38" x2="44" y2="38" strokeWidth={1.5} strokeOpacity={0.4} />
      {/* Y-axis */}
      <line x1="4" y1="8" x2="4" y2="38" strokeWidth={1.5} strokeOpacity={0.4} />
      {/* Data line */}
      <polyline
        points="4,36 12,28 20,32 28,18 36,22 44,10"
        strokeWidth={2.5}
      />
      {/* End point ring + fill */}
      <circle cx="44" cy="10" r="3.5" strokeWidth={2} />
      <circle cx="44" cy="10" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TopKIcon({ className = DEFAULT_CLASS }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox={VIEW_BOX}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Podium bars (2nd, 1st, 3rd) */}
      <rect x="6" y="26" width="10" height="16" rx="2" />
      <rect x="19" y="18" width="10" height="24" rx="2" />
      <rect x="32" y="30" width="10" height="12" rx="2" />
      {/* Medal/circle on winner */}
      <circle cx="24" cy="11" r="5" />
      {/* Star inside medal (rank 1) */}
      <path
        d="M24 7.5l1.2 2.4 2.6.4-1.9 1.8.4 2.6L24 13.2l-2.3 1.5.4-2.6-1.9-1.8 2.6-.4L24 7.5z"
        fill="currentColor"
        stroke="none"
      />
      {/* Rank indicators above 2nd and 3rd bars */}
      <circle cx="11" cy="22" r="2.5" strokeWidth={1.5} strokeOpacity={0.8} />
      <circle cx="37" cy="26" r="2.5" strokeWidth={1.5} strokeOpacity={0.8} />
    </svg>
  );
}
