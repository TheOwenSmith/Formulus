const dayRegex = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toValidTimespan(
  timespan?: [string | undefined, string | undefined],
): [string | undefined, string | undefined] {
  if (timespan == undefined) return [undefined, undefined];

  const timespanDays: [string | undefined, string | undefined] = [undefined, undefined];

  if (timespan[0] != undefined) {
    if (!dayRegex.test(timespan[0])) {
      throw new Error(
        `Timespan is invalid: start date '${timespan[0]}' is not a valid date; it must be of the form YYYY-MM-DD`,
      );
    }
    timespanDays[0] = timespan[0];
  }

  if (timespan[1] != undefined) {
    if (!dayRegex.test(timespan[1])) {
      throw new Error(
        `Timespan is invalid: end date '${timespan[1]}' is not a valid date; it must be of the form YYYY-MM-DD`,
      );
    }
    timespanDays[1] = timespan[1];
  }

  if (
    timespanDays[0] != undefined &&
    timespanDays[1] != undefined &&
    timespanDays[0] >= timespanDays[1]
  ) {
    throw new Error('Timespan is invalid: start date is after or equal to end date');
  }
  return timespanDays;
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
