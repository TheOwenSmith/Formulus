/**
 * UI icon paths (arrows, layout, actions)
 */

// Arrow icons
export const ARROW_LEFT = 'M10 12L6 8L10 4';
export const ARROW_DOWN_SMALL = 'M2.5 3.75L5 6.25L7.5 3.75';
export const CHEVRON_DOWN = 'M4 6L8 10L12 6';

// Layout icons
export const SINGLE_COLUMN = 'M4 4H16V16H4V4Z';

// Side-by-side icon (uses rect elements, not paths)
export const SIDE_BY_SIDE_RECTS = [
  { height: 12, rx: 1, width: 6, x: 3, y: 4 },
  { height: 12, rx: 1, width: 6, x: 11, y: 4 },
] as const;

// Action icons
export const PLUS = 'M8 4V12M4 8H12';

// Menu/List icons
export const MENU_LINES = 'M2.25 4.5H15.75M2.25 9H15.75M2.25 13.5H15.75';
export const MENU_CIRCLES = [
  { cx: '4.5', cy: '4.5', r: '1.5' },
  { cx: '4.5', cy: '9', r: '1.5' },
  { cx: '4.5', cy: '13.5', r: '1.5' },
] as const;

// Chart/Statistics icons
export const CHART_BAR =
  'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z';

// Share icon
export const SHARE =
  'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z';
