export function exhaustiveArray<T>() {
  return <const U extends readonly (keyof T)[]>(
    arr: U & ([keyof T] extends [U[number]] ? unknown : 'Missing keys'),
  ) => arr;
}

export function isRecord(inp: unknown): inp is Record<PropertyKey, unknown> {
  return inp != null && Object.getPrototypeOf(inp) === Object.prototype;
}

export type AtLeastOne<T> = { [K in keyof T]: Required<Pick<T, K>> & Partial<Omit<T, K>> }[keyof T];
