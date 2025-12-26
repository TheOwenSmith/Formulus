/**
 * Formats a number with commas and rounds to a specified number of decimal places
 */
export function withCommasRounded(value: number, decimals: number = 2): string {
  return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

