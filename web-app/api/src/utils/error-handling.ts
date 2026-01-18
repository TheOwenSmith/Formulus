import type { TRPC_ERROR_CODE_KEY } from '@trpc/server';

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

export class ErrorWithCode extends Error {
  code: TRPC_ERROR_CODE_KEY;
  constructor(input: unknown, code: TRPC_ERROR_CODE_KEY) {
    const message = input instanceof Error ? input.stack : String(input);
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}
