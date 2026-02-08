import type { TRPC_ERROR_CODE_KEY } from '@trpc/server';
import { Result, ResultAsync } from 'neverthrow';

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
  code: TRPC_ERROR_CODE_KEY;
};

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
