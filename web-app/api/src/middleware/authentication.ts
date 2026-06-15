import { deleteCachedSession, getCachedSession, setCachedSession } from '@api/lib/cache-session';
import { prisma } from '@api/lib/prisma';
import type { TRPCContext } from '@api/lib/trpc';
import { parseCookies } from '@api/utils/parse-cookies';
import { fromThrowableAsync, internal, type AppError } from '@shared/utils/error-handling';

export function createUserAuthenticationProcedure(t: TRPCContext) {
  return t.procedure.use(async ({ ctx, next }) => {
    const cookies = parseCookies(ctx);
    const sessionToken = cookies['better-auth.session_token']?.split('.', 1)[0];
    if (sessionToken == undefined) {
      throw {
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to perform this action',
      } satisfies AppError;
    }

    // Try Redis cache first
    const cached = await getCachedSession(sessionToken);
    if (cached != null) {
      if (cached.expiresAt < new Date()) {
        // Cached session has expired — evict and fall through to DB
        await deleteCachedSession(sessionToken);
      } else {
        return next({ ctx: { ...ctx, sessionToken, user: cached.user } });
      }
    }

    // Cache miss — hit Postgres
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

    await setCachedSession(sessionToken, { expiresAt: session.expiresAt, user: session.user });

    return next({
      ctx: {
        ...ctx,
        sessionToken,
        user: session.user,
      },
    });
  });
}
