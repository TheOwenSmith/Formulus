import z from 'zod';
import { trySync } from './errorHandling';

export type Day = [year: number, month: number, day: number];
const daySchema = z.tuple([z.number(), z.number(), z.number()]);
const dateStringToDaySchema = z
  .string()
  .regex(/^(\d{4})-(\d{2})-(\d{2})$/)
  .transform((data) => {
    const splitResult = data.split('-').map(Number);
    return daySchema.parse(splitResult);
  });

export function compareDays(day1: Day, day2: Day): number {
  if (day1[0] !== day2[0]) return day1[0] - day2[0];
  if (day1[1] !== day2[1]) return day1[1] - day2[1];
  return day1[2] - day2[2];
}

export function dayToString(day: Day): string {
  return `${day[0]}-${String(day[1]).padStart(2, '0')}-${String(day[2]).padStart(2, '0')}`;
}

export function timestampToDay(timestamp: string): Day {
  const [dateString, _timeString] = timestamp.split(' ');
  const zodParseDayResponse = trySync(() => dateStringToDaySchema.parse(dateString));
  if (!zodParseDayResponse.ok) throw zodParseDayResponse.error;
  return zodParseDayResponse.data;
}

export function timespanToDays(
  timespan?: [string | undefined, string | undefined],
): [Day | undefined, Day | undefined] {
  if (timespan == undefined) return [undefined, undefined];

  const timespanDates: [Day | undefined, Day | undefined] = [undefined, undefined];

  if (timespan[0] != undefined) {
    const zodParseStartDayResponse = trySync(() => dateStringToDaySchema.parse(timespan[0]));
    if (!zodParseStartDayResponse.ok) {
      throw new Error(
        `Timespan is invalid: start date '${timespan[0]}' is not a valid date; it must be of the form YYYY-MM-DD`,
      );
    }
    timespanDates[0] = zodParseStartDayResponse.data;
  }

  if (timespan[1] != undefined) {
    const zodParseEndDayResponse = trySync(() => dateStringToDaySchema.parse(timespan[1]));
    if (!zodParseEndDayResponse.ok) {
      throw new Error(
        `Timespan is invalid: end date '${timespan[1]}' is not a valid date; it must be of the form YYYY-MM-DD`,
      );
    }
    timespanDates[1] = zodParseEndDayResponse.data;
  }

  if (
    timespanDates[0] != undefined &&
    timespanDates[1] != undefined &&
    compareDays(timespanDates[0], timespanDates[1]) >= 0
  ) {
    throw new Error('Timespan is invalid: start date is after or equal to end date');
  }
  return timespanDates;
}

export function yearsBetween(day1: Day, day2: Day): number {
  // Convert both days to Date objects for accurate calculation
  const date1 = new Date(day1[0], day1[1] - 1, day1[2]); // month is 0-indexed in Date
  const date2 = new Date(day2[0], day2[1] - 1, day2[2]);

  // Calculate difference in milliseconds
  const diffMs = date1.getTime() - date2.getTime();

  // Convert to years (365.25 days per year accounts for leap years)
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  return diffMs / msPerYear;
}
