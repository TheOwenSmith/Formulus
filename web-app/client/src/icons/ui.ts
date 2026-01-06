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

