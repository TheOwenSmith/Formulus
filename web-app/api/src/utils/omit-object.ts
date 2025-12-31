export function omitObject<T extends Record<PropertyKey, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const result = {} as Record<PropertyKey, unknown>;
  const keysSet = new Set<PropertyKey>(keys);
  for (const key in obj) {
    if (!keysSet.has(key)) {
      result[key] = obj[key];
    }
  }
  return result as Omit<T, K>;
}
