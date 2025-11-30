import z from 'zod';
import { trySync } from './errorHandling';

export type Day = [year: number, month: number, day: number];
const daySchema = z.tuple([z.number(), z.number(), z.number()]);

export function compareDays(day1: Day, day2: Day): number {
  if (day1[0] !== day2[0]) return day1[0] - day2[0];
  if (day1[1] !== day2[1]) return day1[1] - day2[1];
  return day1[2] - day2[2];
}

export function dateToDay(timestamp: string) {
  const [datePart, _timePart] = timestamp.split(' ');
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
      `Timespan is invalid: end date ${timespan[1]} is not a valid date; it must be of the form YYYY-MM-DD`,
    );
  }
  timespanDates[1] = unparsedEndDayResponse.data;

  if (compareDays(timespanDates[0], timespanDates[1]) >= 0) {
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
