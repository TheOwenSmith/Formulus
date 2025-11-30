export function groupBy<K extends PropertyKey, T>(
  arr: T[],
  groupByFn: (val: T) => K,
): Record<K, T[]> {
  return arr.reduce(
    (acc, val) => {
      const mappedKey = groupByFn(val);
      if (!Object.prototype.hasOwnProperty.call(acc, mappedKey)) {
        acc[mappedKey] = [];
      }
      acc[mappedKey].push(val);

      return acc;
    },
    {} as Record<K, T[]>,
  );
}
