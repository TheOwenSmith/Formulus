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

type TRPC_ERROR_CODE =
  | 'INTERNAL_SERVER_ERROR'
  | 'PARSE_ERROR'
  | 'BAD_REQUEST'
  | 'NOT_IMPLEMENTED'
  | 'BAD_GATEWAY'
  | 'SERVICE_UNAVAILABLE'
  | 'GATEWAY_TIMEOUT'
  | 'UNAUTHORIZED'
  | 'PAYMENT_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'METHOD_NOT_SUPPORTED'
  | 'TIMEOUT'
  | 'CONFLICT'
  | 'PRECONDITION_FAILED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'UNPROCESSABLE_CONTENT'
  | 'PRECONDITION_REQUIRED'
  | 'TOO_MANY_REQUESTS'
  | 'CLIENT_CLOSED_REQUEST';

export type AppError = {
  message?: string;
  error?: unknown;
  code: TRPC_ERROR_CODE;
  isUserCode?: boolean;
};

export const TRPC_ERROR_CODE_TO_HTTP_STATUS: Record<TRPC_ERROR_CODE, number> = {
  PARSE_ERROR: 400,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_SUPPORTED: 405,
  TIMEOUT: 408,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_CONTENT: 422,
  PRECONDITION_REQUIRED: 428,
  TOO_MANY_REQUESTS: 429,
  CLIENT_CLOSED_REQUEST: 499,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
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

export function isPrismaUniqueConstraintError(e: unknown): boolean {
  return (
    typeof e === 'object' && e != null && 'code' in e && (e as { code: unknown }).code === 'P2002'
  );
}
