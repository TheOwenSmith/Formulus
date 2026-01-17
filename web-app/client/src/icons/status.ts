/**
 * Status and feedback icon paths (check, warning, edit, loading)
 */

// Status icons
export const CHECK = 'M5 13l4 4L19 7';

export const WARNING =
  'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';

export const ERROR =
  'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';

// Editing icons
export const EDIT =
  'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z';

// Loading/Spinner icons
export const SPINNER_CIRCLE = {
  cx: '12',
  cy: '12',
  r: '10',
  stroke: 'currentColor',
  strokeWidth: '4',
} as const;

export const SPINNER_PATH =
  'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z';
