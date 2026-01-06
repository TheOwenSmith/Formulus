/**
 * Common SVG attributes and properties
 */

export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

// Common stroke properties
export const STROKE_PROPERTIES = {
  stroke: 'currentColor',
  strokeWidth: '2',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
} as const;

export const STROKE_PROPERTIES_SMALL = {
  stroke: 'currentColor',
  strokeWidth: '1.5',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
} as const;

export const STROKE_PROPERTIES_THICK = {
  stroke: 'currentColor',
  strokeWidth: '2.5',
  strokeLinecap: 'round' as const,
} as const;
