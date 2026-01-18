export type Result<T> = { ok: true; data: T } | { ok: false; error: unknown };

export function trySync<T>(wrapperFn: () => T): Result<T> {
  try {
    return { ok: true, data: wrapperFn() };
  } catch (e) {
    return { ok: false, error: e };
  }
}

export async function tryAsync<T>(wrapperFn: () => T | Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await wrapperFn() };
  } catch (e) {
    return { ok: false, error: e };
  }
}
