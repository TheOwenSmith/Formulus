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

const easternTimeOptions: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: 'numeric',
  timeZone: 'America/New_York',
  hour12: false, // Use 24-hour format for easier comparison
};

export function isMarketOpen(date: Date): boolean {
  // Get the hour and minute parts in Eastern Time
  const parts = new Intl.DateTimeFormat('en-US', easternTimeOptions).formatToParts(date);

  const hourAsString = parts.find((part) => part.type === 'hour')?.value;
  const minuteAsString = parts.find((part) => part.type === 'minute')?.value;
  if (hourAsString == undefined || minuteAsString == undefined) return false;

  const hour = parseInt(hourAsString, 10);
  const minute = parseInt(minuteAsString, 10);

  // Check if the time is after 9:30 AM
  const after930am = hour > 9 || (hour === 9 && minute >= 30);

  // Check if the time is before 4:00 PM
  const before4pm = hour < 16 || (hour === 16 && minute === 0);

  return after930am && before4pm;
}

export function millisecondsToTimeString(milliseconds: number): string {
  const days = Math.floor(milliseconds / 86_400_000)
    .toString()
    .padStart(2, '0');
  const hours = Math.floor((milliseconds % 86_400_000) / 3_600_000)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor((milliseconds % 60_000) / 1_000)
    .toString()
    .padStart(2, '0');
  return `${days}d ${hours}:${minutes}:${seconds}`;
}
