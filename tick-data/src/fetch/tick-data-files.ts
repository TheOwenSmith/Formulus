export const secondDataFilename = './data/SPY_1SECOND_2020-10-18_to_2025-10-19.csv';
export const fifteenSecondDataFilename = './data/SPY_15SECOND_2020-10-19_to_2025-10-19.csv';
export const minuteDataFilename = './data/SPY_1MINUTE_2020-10-19_to_2025-10-19.csv';
export const fifteenMinuteDataFilename = './data/SPY_15MINUTE_2020-10-19_to_2025-10-19.csv';
export const hourDataFilename = './data/SPY_1HOUR_2020-10-19_to_2025-10-19.csv';
export const dailyDataFilename = './data/SPY_1DAY_2020-10-19_to_2025-10-19.csv';

export const tickDataFilenames = [
  secondDataFilename,
  fifteenSecondDataFilename,
  minuteDataFilename,
  fifteenMinuteDataFilename,
  hourDataFilename,
  dailyDataFilename,
];

export const secondDataWithAggregateInMilliseconds = {
  filename: secondDataFilename,
  aggregateInMilliseconds: 1_000,
};
export const fifteenSecondDataWithAggregateInMilliseconds = {
  filename: fifteenSecondDataFilename,
  aggregateInMilliseconds: 15_000,
};
export const minuteDataWithAggregateInMilliseconds = {
  filename: minuteDataFilename,
  aggregateInMilliseconds: 60_000,
};
export const fifteenMinuteDataWithAggregateInMilliseconds = {
  filename: fifteenMinuteDataFilename,
  aggregateInMilliseconds: 900_000,
};
export const hourDataWithAggregateInMilliseconds = {
  filename: hourDataFilename,
  aggregateInMilliseconds: 3_600_000,
};
export const dailyDataWithAggregateInMilliseconds = {
  filename: dailyDataFilename,
  aggregateInMilliseconds: 86_400_000,
};

export const dataFilenamesAndAggregateInMilliseconds: {
  filename: string;
  aggregateInMilliseconds: number;
}[] = [
  secondDataWithAggregateInMilliseconds,
  fifteenSecondDataWithAggregateInMilliseconds,
  minuteDataWithAggregateInMilliseconds,
  fifteenMinuteDataWithAggregateInMilliseconds,
  hourDataWithAggregateInMilliseconds,
  dailyDataWithAggregateInMilliseconds,
];
