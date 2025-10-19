/**
 * Helper function to format a Date object into YYYY-MM-DD string
 * @param date - The date object to format
 * @returns A string in YYYY-MM-DD format
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get an array of date ranges for the past N years
 * @param years - Number of years to go back
 * @param chunkSize - Size of each chunk (using GetStocksAggregatesTimespanEnum)
 */
export function getDateChunks(
  years: number,
  chunkSizeInDays: number,
): Array<{ from: Date; to: Date }> {
  const chunks = [];
  const now = new Date();

  if (chunkSizeInDays === 1) {
    throw new Error('API does not support chunk size of 1 day!');
  }

  // Round start date to midnight (00:00:00.000Z)
  const startDate = new Date();
  startDate.setFullYear(now.getFullYear() - years);
  startDate.setHours(0, 0, 0, 0);

  const currentStart = new Date(startDate);
  const currentEnd = new Date(currentStart);
  currentEnd.setDate(currentEnd.getDate() + (chunkSizeInDays - 1));

  while (currentStart < now) {
    // Don't go beyond today
    if (currentEnd > now) {
      currentEnd.setTime(now.getTime());
    }

    chunks.push({
      from: new Date(currentStart),
      to: new Date(currentEnd),
    });

    // Start the next chunk where this one ended (no overlap with half-open intervals)
    currentStart.setDate(currentStart.getDate() + chunkSizeInDays);
    currentEnd.setDate(currentEnd.getDate() + chunkSizeInDays);
  }

  return chunks;
}

/**
 * Get an array of date ranges for the past N years
 * @param years - Number of years to go back
 * @param chunkSize - Size of each chunk (using GetStocksAggregatesTimespanEnum)
 */
export function getTimestampChunks(
  years: number,
  chunkSizeInMilliseconds: number,
): Array<{ from: number; to: number }> {
  const chunks = [];
  const now = new Date();
  const nowMilliseconds = now.getTime();

  // Round start date to midnight (00:00:00.000Z)
  const startDate = new Date();
  startDate.setFullYear(now.getFullYear() - years);
  startDate.setHours(0, 0, 0, 0);

  let currentStart = startDate.getTime();
  let currentEnd = currentStart + chunkSizeInMilliseconds;

  while (currentStart < nowMilliseconds) {
    // Don't go beyond today
    if (currentEnd > nowMilliseconds) {
      currentEnd = nowMilliseconds;
    }

    chunks.push({
      from: currentStart,
      to: currentEnd,
    });

    // Start the next chunk where this one ended (no overlap with half-open intervals)
    currentStart += chunkSizeInMilliseconds;
    currentEnd += chunkSizeInMilliseconds;
  }

  return chunks;
}
