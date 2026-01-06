export function yearsBetween(endDay: string, startDay: string): number {
  // Convert both days to Date objects for accurate calculation
  const startDate = new Date(startDay); // month is 0-indexed in Date
  const endDate = new Date(endDay);

  // Calculate difference in milliseconds
  const diffMs = endDate.getTime() - startDate.getTime();

  // Convert to years (365.25 days per year accounts for leap years)
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  return diffMs / msPerYear;
}
