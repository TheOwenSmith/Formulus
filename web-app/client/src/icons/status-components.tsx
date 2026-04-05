/**
 * Status icon components (check, loading spinner) for use in UI.
 * Uses path data from status.ts.
 */

import { CHECK, SPINNER_CIRCLE, SPINNER_PATH } from './status';

export function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={CHECK} />
    </svg>
  );
}

export function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx={SPINNER_CIRCLE.cx}
        cy={SPINNER_CIRCLE.cy}
        r={SPINNER_CIRCLE.r}
        stroke={SPINNER_CIRCLE.stroke}
        strokeWidth={SPINNER_CIRCLE.strokeWidth}
      />
      <path className="opacity-75" fill="currentColor" d={SPINNER_PATH} />
    </svg>
  );
}
