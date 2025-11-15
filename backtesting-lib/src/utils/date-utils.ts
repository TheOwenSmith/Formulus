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
  startOfTickTimestamp: string,
  aggregateInMilliseconds: number,
): boolean {
  const [_datePart, timePart] = startOfTickTimestamp.split(' ');
  let [hour, minute] = timePart.split(':').map(Number);
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
