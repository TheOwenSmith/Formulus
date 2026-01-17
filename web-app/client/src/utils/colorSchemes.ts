// Color scheme definitions for different algorithm cards
// Each scheme provides a distinct color palette for visual differentiation
export const colorSchemes = [
  {
    accentBorder: 'border-blue-600/20',
    bgGradient: 'from-blue-950/20',
    bgGradientTo: 'to-indigo-950/20',
    borderColor: 'border-blue-600/30',
    buttonBg: 'bg-blue-600/20',
    buttonBorder: 'border-blue-600/40',
    buttonHoverBg: 'hover:bg-blue-600/30',
    buttonHoverBorder: 'hover:border-blue-600/60',
    buttonText: 'text-blue-300',
    // Deep Blue to Indigo - distinct from cyan variants
    gradientFrom: 'from-blue-600',
    gradientTo: 'to-indigo-400',
    primaryColor: '#2563eb', // blue-600 (deeper)
    primaryColorLight: '#3b82f6', // blue-500 (lighter)
    shadowColor: 'shadow-blue-600/10',
  },
  {
    accentBorder: 'border-emerald-500/20',
    bgGradient: 'from-emerald-950/20',
    bgGradientTo: 'to-green-950/20',
    borderColor: 'border-emerald-500/30',
    buttonBg: 'bg-emerald-500/20',
    buttonBorder: 'border-emerald-500/40',
    buttonHoverBg: 'hover:bg-emerald-500/30',
    buttonHoverBorder: 'hover:border-emerald-500/60',
    buttonText: 'text-emerald-400',
    // Emerald to Green - distinct green-blue
    gradientFrom: 'from-emerald-500',
    gradientTo: 'to-green-400',
    primaryColor: '#10b981', // emerald-500
    primaryColorLight: '#34d399', // emerald-400
    shadowColor: 'shadow-emerald-500/10',
  },
  {
    accentBorder: 'border-fuchsia-600/20',
    bgGradient: 'from-fuchsia-950/20',
    bgGradientTo: 'to-purple-950/20',
    borderColor: 'border-fuchsia-600/30',
    buttonBg: 'bg-fuchsia-600/20',
    buttonBorder: 'border-fuchsia-600/40',
    buttonHoverBg: 'hover:bg-fuchsia-600/30',
    buttonHoverBorder: 'hover:border-fuchsia-600/60',
    buttonText: 'text-fuchsia-300',
    // Fuchsia to Purple - vibrant magenta-purple
    gradientFrom: 'from-fuchsia-600',
    gradientTo: 'to-purple-400',
    primaryColor: '#c026d3', // fuchsia-600 (deeper)
    primaryColorLight: '#d946ef', // fuchsia-500 (lighter)
    shadowColor: 'shadow-fuchsia-600/10',
  },
  {
    accentBorder: 'border-orange-500/20',
    bgGradient: 'from-orange-950/20',
    bgGradientTo: 'to-red-950/20',
    borderColor: 'border-orange-500/30',
    buttonBg: 'bg-orange-500/20',
    buttonBorder: 'border-orange-500/40',
    buttonHoverBg: 'hover:bg-orange-500/30',
    buttonHoverBorder: 'hover:border-orange-500/60',
    buttonText: 'text-orange-400',
    // Orange to Red - warm orange-red
    gradientFrom: 'from-orange-500',
    gradientTo: 'to-red-600',
    primaryColor: '#f97316', // orange-500
    primaryColorLight: '#fb923c', // orange-400
    shadowColor: 'shadow-orange-500/10',
  },
  {
    accentBorder: 'border-pink-500/20',
    bgGradient: 'from-pink-950/20',
    bgGradientTo: 'to-rose-950/20',
    borderColor: 'border-pink-500/30',
    buttonBg: 'bg-pink-500/20',
    buttonBorder: 'border-pink-500/40',
    buttonHoverBg: 'hover:bg-pink-500/30',
    buttonHoverBorder: 'hover:border-pink-500/60',
    buttonText: 'text-pink-400',
    // Pink to Rose - distinct pink-rose gradient
    gradientFrom: 'from-pink-500',
    gradientTo: 'to-rose-400',
    primaryColor: '#ec4899', // pink-500
    primaryColorLight: '#f472b6', // pink-400
    shadowColor: 'shadow-pink-500/10',
  },
  {
    accentBorder: 'border-yellow-500/20',
    bgGradient: 'from-yellow-950/20',
    bgGradientTo: 'to-amber-950/20',
    borderColor: 'border-yellow-500/30',
    buttonBg: 'bg-yellow-500/20',
    buttonBorder: 'border-yellow-500/40',
    buttonHoverBg: 'hover:bg-yellow-500/30',
    buttonHoverBorder: 'hover:border-yellow-500/60',
    buttonText: 'text-yellow-400',
    // Yellow to Amber - bright yellow-amber
    gradientFrom: 'from-yellow-500',
    gradientTo: 'to-amber-300',
    primaryColor: '#eab308', // yellow-500
    primaryColorLight: '#facc15', // yellow-400
    shadowColor: 'shadow-yellow-500/10',
  },
  {
    accentBorder: 'border-rose-600/20',
    bgGradient: 'from-rose-950/20',
    bgGradientTo: 'to-red-950/20',
    borderColor: 'border-rose-600/30',
    buttonBg: 'bg-rose-600/20',
    buttonBorder: 'border-rose-600/40',
    buttonHoverBg: 'hover:bg-rose-600/30',
    buttonHoverBorder: 'hover:border-rose-600/60',
    buttonText: 'text-rose-300',
    // Rose to Red - distinct pink-red
    gradientFrom: 'from-rose-600',
    gradientTo: 'to-red-500',
    primaryColor: '#e11d48', // rose-600 (deeper)
    primaryColorLight: '#f43f5e', // rose-500 (lighter)
    shadowColor: 'shadow-rose-600/10',
  },
  {
    accentBorder: 'border-teal-500/20',
    bgGradient: 'from-teal-950/20',
    bgGradientTo: 'to-cyan-950/20',
    borderColor: 'border-teal-500/30',
    buttonBg: 'bg-teal-500/20',
    buttonBorder: 'border-teal-500/40',
    buttonHoverBg: 'hover:bg-teal-500/30',
    buttonHoverBorder: 'hover:border-teal-500/60',
    buttonText: 'text-teal-400',
    // Teal to Cyan - distinct blue-green
    gradientFrom: 'from-teal-500',
    gradientTo: 'to-cyan-400',
    primaryColor: '#14b8a6', // teal-500
    primaryColorLight: '#2dd4bf', // teal-400
    shadowColor: 'shadow-teal-500/10',
  },
  {
    accentBorder: 'border-cyan-400/20',
    bgGradient: 'from-cyan-950/20',
    bgGradientTo: 'to-sky-950/20',
    borderColor: 'border-cyan-400/30',
    buttonBg: 'bg-cyan-400/20',
    buttonBorder: 'border-cyan-400/40',
    buttonHoverBg: 'hover:bg-cyan-400/30',
    buttonHoverBorder: 'hover:border-cyan-400/60',
    buttonText: 'text-cyan-300',
    // Bright Cyan to Sky - vibrant bright cyan (distinct from teal-cyan)
    gradientFrom: 'from-cyan-400',
    gradientTo: 'to-sky-300',
    primaryColor: '#22d3ee', // cyan-400 (bright)
    primaryColorLight: '#67e8f9', // cyan-300 (lighter)
    shadowColor: 'shadow-cyan-400/10',
  },
  {
    accentBorder: 'border-lime-500/20',
    bgGradient: 'from-lime-950/20',
    bgGradientTo: 'to-yellow-950/20',
    borderColor: 'border-lime-500/30',
    buttonBg: 'bg-lime-500/20',
    buttonBorder: 'border-lime-500/40',
    buttonHoverBg: 'hover:bg-lime-500/30',
    buttonHoverBorder: 'hover:border-lime-500/60',
    buttonText: 'text-lime-400',
    // Lime to Yellow - bright green-yellow
    gradientFrom: 'from-lime-500',
    gradientTo: 'to-yellow-400',
    primaryColor: '#84cc16', // lime-500
    primaryColorLight: '#a3e635', // lime-400
    shadowColor: 'shadow-lime-500/10',
  },
];
