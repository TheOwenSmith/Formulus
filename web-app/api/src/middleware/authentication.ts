import { prisma } from '@api/lib/prisma';
import type { TRPCContext } from '@api/lib/trpc';
import { tryAsync } from '@api/utils/error-handling';
import { parseCookies } from '@api/utils/parse-cookies';
import { TRPCError } from '@trpc/server';

export function createUserAuthenticationProcedure(t: TRPCContext) {
  return t.procedure.use(async ({ ctx, next }) => {
    // Get session token
    const cookies = parseCookies(ctx);
    const sessionToken = cookies['better-auth.session_token']?.split('.', 1)[0];
    if (sessionToken == undefined) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to perform this action',
      });
    }

    // Get session from database
    const getSessionResponse = await tryAsync(() =>
      prisma.session.findUnique({
        where: { token: sessionToken },
        include: { user: true },
      }),
    );
    if (!getSessionResponse.ok) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while retrieving the session from the database',
      });
    }
    const session = getSessionResponse.data;

    if (session == null || session.expiresAt < new Date()) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Session expired or invalid',
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: session.user,
      },
    });
  });
}
