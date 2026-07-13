import { deleteCachedSession, getCachedSession, setCachedSession } from '@api/lib/cache-session';
import { prisma } from '@api/lib/prisma';
import type { Context, TRPCContext } from '@api/lib/trpc';
import { parseCookies } from '@api/utils/parse-cookies';
import type { UserModel } from '@shared/generated/prisma/models';
import { fromThrowableAsync, internal, type AppError } from '@shared/utils/error-handling';

type SessionResolution =
  | { status: 'missing' }
  | { status: 'invalid' }
  | { status: 'authenticated'; sessionToken: string; user: UserModel };

async function resolveSession(ctx: Context): Promise<SessionResolution> {
  const cookies = parseCookies(ctx);
  const sessionToken = cookies['better-auth.session_token']?.split('.', 1)[0];
  if (sessionToken == undefined) {
    return { status: 'missing' };
  }

  // Try Redis cache first
  const cached = await getCachedSession(sessionToken);
  if (cached != null) {
    if (cached.expiresAt < new Date()) {
      // Cached session has expired, so evict and fall through to DB
      await deleteCachedSession(sessionToken);
    } else {
      return { status: 'authenticated', sessionToken, user: cached.user };
    }
  }

  // User not in cache, so query postgres
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
    return { status: 'invalid' };
  }

  await setCachedSession(sessionToken, { expiresAt: session.expiresAt, user: session.user });

  return { status: 'authenticated', sessionToken, user: session.user };
}

export function createUserAuthenticationProcedure(t: TRPCContext) {
  return t.procedure.use(async ({ ctx, next }) => {
    const session = await resolveSession(ctx);
    if (session.status === 'missing') {
      throw {
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to perform this action',
      } satisfies AppError;
    }
    if (session.status === 'invalid') {
      throw {
        code: 'UNAUTHORIZED',
        message: 'Session expired or invalid',
      } satisfies AppError;
    }

    return next({
      ctx: {
        ...ctx,
        sessionToken: session.sessionToken,
        user: session.user,
      },
    });
  });
}

// Like the auth procedure, but anonymous requests proceed with ctx.user = null
export function createOptionalUserAuthenticationProcedure(t: TRPCContext) {
  return t.procedure.use(async ({ ctx, next }) => {
    const session = await resolveSession(ctx);
    const authenticated = session.status === 'authenticated';

    return next({
      ctx: {
        ...ctx,
        sessionToken: authenticated ? session.sessionToken : null,
        user: authenticated ? session.user : null,
      },
    });
  });
}
