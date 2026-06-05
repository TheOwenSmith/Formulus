import type { TRPC_ERROR_CODE_KEY } from '@trpc/server';

export type AppError = {
  message?: string;
  error?: unknown;
  code: TRPC_ERROR_CODE_KEY;
};

export function isPrismaUniqueConstraintError(e: unknown): boolean {
  return (
    typeof e === 'object' && e != null && 'code' in e && (e as { code: unknown }).code === 'P2002'
  );
}
