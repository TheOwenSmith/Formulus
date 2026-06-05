import { prisma } from '@api/lib/prisma';
import type { TRPCContext } from '@api/lib/trpc';
import { parseCookies } from '@api/utils/parse-cookies';
import { fromThrowableAsync, internal, type AppError } from '@shared/utils/error-handling';

export function createUserAuthenticationProcedure(t: TRPCContext) {
  return t.procedure.use(async ({ ctx, next }) => {
    // Get session token
    const cookies = parseCookies(ctx);
    const sessionToken = cookies['better-auth.session_token']?.split('.', 1)[0];
    if (sessionToken == undefined) {
      throw {
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to perform this action',
      } satisfies AppError;
    }

    // Get session from database
    const getSessionResponse = await fromThrowableAsync(
      () =>
        prisma.session.findUnique({
          where: { token: sessionToken },
          include: { user: true },
        }),
      (e) =>
        internal(e, 'An unexpected error occurred while retrieving the session from the database'),
    );
    if (getSessionResponse.isErr()) {
      throw getSessionResponse.error;
    }
    const session = getSessionResponse.value;

    if (session == null || session.expiresAt < new Date()) {
      throw {
        code: 'UNAUTHORIZED',
        message: 'Session expired or invalid',
      } satisfies AppError;
    }

    return next({
      ctx: {
        ...ctx,
        user: session.user,
      },
    });
  });
}
