/**
 * Throttle function to limit how often a function can be called
 * @param func The function to throttle
 * @param limit The time limit in milliseconds
 * @returns A throttled version of the function
 */
export function throttle<TArgs extends readonly unknown[], TReturn>(
  func: (...args: TArgs) => TReturn,
  limit: number,
): (...args: TArgs) => void {
  let inThrottle: boolean;
  return ((...args: TArgs) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  }) as (...args: TArgs) => void;
}
