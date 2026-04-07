export function isRecord(inp: unknown): inp is Record<PropertyKey, unknown> {
  return inp != null && Object.getPrototypeOf(inp) === Object.prototype;
}

export type AtLeastOne<T> = { [K in keyof T]: Required<Pick<T, K>> & Partial<Omit<T, K>> }[keyof T];

export function completeUnionArray<T>() {
  return <U extends T[]>(
    arr: U & ([T] extends [U[number]] ? unknown : 'Missing elements from union'),
  ) => arr;
}
