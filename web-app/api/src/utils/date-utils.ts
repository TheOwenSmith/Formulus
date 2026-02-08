import { err, ok, Result } from 'neverthrow';
import { badRequest, type AppError } from './error-handling';

const dayRegex = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toValidTimespan(
  timespan?: [string | null, string | null] | undefined,
): Result<[string | null, string | null], AppError> {
  if (timespan == undefined) return ok([null, null]);

  const timespanDays: [string | null, string | null] = [null, null];

  if (timespan[0] != null) {
    if (!dayRegex.test(timespan[0])) {
      return err(
        badRequest(
          `Timespan is invalid: start date '${timespan[0]}' is not a valid date; it must be of the form YYYY-MM-DD`,
        ),
      );
    }
    timespanDays[0] = timespan[0];
  }

  if (timespan[1] != null) {
    if (!dayRegex.test(timespan[1])) {
      return err(
        badRequest(
          `Timespan is invalid: end date '${timespan[1]}' is not a valid date; it must be of the form YYYY-MM-DD`,
        ),
      );
    }
    timespanDays[1] = timespan[1];
  }

  if (timespanDays[0] != null && timespanDays[1] != null && timespanDays[0] >= timespanDays[1]) {
    return err(badRequest('Timespan is invalid: start date is after or equal to end date'));
  }
  return ok(timespanDays);
}

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
