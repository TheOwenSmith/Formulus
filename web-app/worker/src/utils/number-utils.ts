export function withCommas(number: number): string {
  const [integer, decimal] = number.toString().split('.');
  const integerWithCommas = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimal != undefined ? `${integerWithCommas}.${decimal}` : integerWithCommas;
}

export function roundToDecimal(number: number, decimals: number): number {
  return Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

export function withCommasRounded(number: number): string {
  const fixed = number.toFixed(2);
  const [integer, decimal] = fixed.split('.');
  const integerWithCommas = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${integerWithCommas}.${decimal}`;
}
