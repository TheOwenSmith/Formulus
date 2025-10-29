import z from 'zod';
import { trySync } from './errorHandling';

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

export type Day = [year: number, month: number, day: number];
const daySchema = z.tuple([z.number(), z.number(), z.number()]);

export function compareDays(day1: Day, day2: Day): number {
  if (day1[0] !== day2[0]) return day1[0] - day2[0];
  if (day1[1] !== day2[1]) return day1[1] - day2[1];
  return day1[2] - day2[2];
}

export function dateToDay(dateAsString: string) {
  const [datePart, _timePart] = dateAsString.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const zodParsedDayResponse = trySync(() => daySchema.parse([year, month, day]));
  if (!zodParsedDayResponse.ok) throw zodParsedDayResponse.error;
  return zodParsedDayResponse.data;
}

export function timespanToDays(timespan: [string, string]): [Day, Day] {
  const timespanDates: [Day, Day] = [
    [0, 0, 0],
    [0, 0, 0],
  ];

  const unparsedStartDay = timespan[0].split('-').map(Number);
  const zodParsedStartDayResponse = trySync(() => daySchema.parse(unparsedStartDay));
  if (!zodParsedStartDayResponse.ok) {
    throw new Error(
      `Timespan is invalid: start date ${timespan[0]} is not a valid date; it must be of the form YYYY-MM-DD`,
    );
  }
  timespanDates[0] = zodParsedStartDayResponse.data;

  const unparsedEndDay = timespan[1].split('-').map(Number);
  const unparsedEndDayResponse = trySync(() => daySchema.parse(unparsedEndDay));
  if (!unparsedEndDayResponse.ok) {
    throw new Error(
      `Timespan is invalid: start date ${timespan[1]} is not a valid date; it must be of the form YYYY-MM-DD`,
    );
  }
  timespanDates[1] = unparsedEndDayResponse.data;

  if (compareDays(timespanDates[0], timespanDates[1]) >= 0) {
    throw new Error('Timespan is invalid: start date is after or equal to end date');
  }
  return timespanDates;
}

export function isMarketOpenByEndOfTick(
  startOfTickAsString: string,
  aggregateInMilliseconds: number,
): boolean {
  const [_datePart, timePart] = startOfTickAsString.split(' ');
  let [hour, minute, _second] = timePart.split(':').map(Number);
  hour = (hour + Math.floor(aggregateInMilliseconds / 3_600_000)) % 24;
  minute = (minute + Math.floor((aggregateInMilliseconds % 3_600_000) / 60_000)) % 60;
  return (hour === 9 && minute >= 30) || (9 < hour && hour < 16);
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
