/**
 * Tailwind color palette mapping for gradient generation
 * Maps Tailwind color names to their hex values
 */
const tailwindColors: Record<string, string> = {
  // Amber shades
  'amber-300': '#fcd34d',
  'amber-400': '#fbbf24',
  'amber-500': '#f59e0b',
  // Blue shades
  'blue-300': '#93c5fd',
  'blue-400': '#60a5fa',
  'blue-500': '#3b82f6',
  'blue-600': '#2563eb',
  // Cyan shades
  'cyan-300': '#67e8f9',
  'cyan-400': '#22d3ee',
  'cyan-500': '#06b6d4',
  // Emerald shades
  'emerald-300': '#6ee7b7',
  'emerald-400': '#34d399',
  'emerald-500': '#10b981',
  'emerald-600': '#059669',
  // Fuchsia shades
  'fuchsia-300': '#f0abfc',
  'fuchsia-400': '#e879f9',
  'fuchsia-500': '#d946ef',
  // Indigo shades
  'indigo-300': '#a5b4fc',
  'indigo-400': '#818cf8',
  'indigo-500': '#6366f1',
  'indigo-600': '#4f46e5',
  // Orange shades
  'orange-300': '#fdba74',
  'orange-400': '#fb923c',
  'orange-500': '#f97316',
  'orange-600': '#ea580c',
  // Pink shades
  'pink-300': '#f9a8d4',
  'pink-400': '#f472b6',
  'pink-500': '#ec4899',
  // Purple shades
  'purple-300': '#d8b4fe',
  'purple-400': '#c084fc',
  'purple-500': '#a855f7',
  'purple-600': '#9333ea',
  // Red shades
  'red-300': '#fca5a5',
  'red-400': '#f87171',
  'red-500': '#ef4444',
  'red-600': '#dc2626',
  // Rose shades
  'rose-300': '#fda4af',
  'rose-400': '#fb7185',
  'rose-500': '#f43f5e',
  'rose-600': '#e11d48',
  // Sky shades
  'sky-300': '#7dd3fc',
  'sky-400': '#38bdf8',
  'sky-500': '#0ea5e9',
  'sky-600': '#0284c7',
  // Teal shades
  'teal-300': '#5eead4',
  'teal-400': '#2dd4bf',
  'teal-500': '#14b8a6',
  // Violet shades
  'violet-300': '#c4b5fd',
  'violet-400': '#a78bfa',
  'violet-500': '#8b5cf6',
  // Yellow shades
  'yellow-300': '#fde047',
  'yellow-400': '#facc15',
  'yellow-500': '#eab308',
  'yellow-600': '#ca8a04',
};

/**
 * Extracts the color name from a Tailwind gradient class
 * e.g., "from-blue-400" -> "blue-400"
 */
function extractColorName(tailwindClass: string): string {
  // Remove "from-", "to-", "via-" prefixes
  return tailwindClass.replace(/^(from-|to-|via-)/, '');
}

/**
 * Gets the hex color value for a Tailwind color name
 */
export function getTailwindColorHex(tailwindColor: string): string {
  const colorName = extractColorName(tailwindColor);
  return tailwindColors[colorName] || '#3b82f6'; // Default to blue-500
}

/**
 * Generates a gradient string from two Tailwind color classes
 * @param fromColor Tailwind class like "from-blue-400"
 * @param toColor Tailwind class like "to-cyan-400"
 * @returns CSS linear-gradient string
 */
export function generateGradientFromTailwind(fromColor: string, toColor: string): string {
  const fromHex = getTailwindColorHex(fromColor);
  const toHex = getTailwindColorHex(toColor);
  return `linear-gradient(90deg, ${fromHex}, ${toHex})`;
}
