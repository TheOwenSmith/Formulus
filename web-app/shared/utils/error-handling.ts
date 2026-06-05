import { ok, Result, ResultAsync } from 'neverthrow';
import z from 'zod';

export const fromThrowable = <T>(
  fn: () => T,
  mapErr: (e: unknown) => AppError,
): Result<T, AppError> => Result.fromThrowable(fn, mapErr)();

export const fromThrowableAsync = <T>(
  fn: () => Promise<T>,
  mapErr: (e: unknown) => AppError,
): ResultAsync<T, AppError> => ResultAsync.fromThrowable(fn, mapErr)();

export type AppError = {
  message?: string;
  error?: unknown;
  code: 'INTERNAL_SERVER_ERROR' | 'BAD_REQUEST' | 'USER_CODE_ERROR';
  isUserCode?: boolean;
};

export const appErrorSchema = z
  .object({
    message: z.string().optional(),
    error: z.unknown().optional(),
    code: z.string(),
  })
  .strict();

export function isAppError(x: unknown): x is AppError {
  return appErrorSchema.safeParse(x).success;
}

export function internal(error: unknown, message?: string): AppError {
  return {
    code: 'INTERNAL_SERVER_ERROR',
    error,
    message,
  };
}

export function badRequest(message: string, error?: unknown): AppError {
  return {
    code: 'BAD_REQUEST',
    message,
    error,
  };
}

export function userCodeError(message: string, error?: unknown): AppError {
  return {
    code: 'BAD_REQUEST',
    error,
    isUserCode: true,
    message,
  };
}

export function safeReduce<T, U, E>(
  arr: T[],
  reducer: (acc: U, value: T) => Result<U, E>,
  startAcc: U,
): Result<U, E> {
  return arr.reduce<Result<U, E>>(
    (accResult, value) => accResult.andThen((acc: U) => reducer(acc, value)),
    ok(startAcc) as Result<U, E>,
  );
}
