import { createUserAuthenticationProcedure } from '@api/middleware/authentication';
import { algorithmsRouter } from '@api/routes/algorithms';
import { backtestingRouter } from '@api/routes/backtesting';
import { paymentsRouter } from '@api/routes/payments';
import { sharingRouter } from '@api/routes/sharing';
import { usersRouter } from '@api/routes/users';
import { isAppError } from '@api/utils/error-handling';
import { initTRPC } from '@trpc/server';
import { type CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { config } from './config';

export const createContext = (x: CreateExpressContextOptions) => x;
export type Context = Awaited<ReturnType<typeof createContext>>;

export const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error, ctx }) {
    const errorCode = isAppError(error.cause) ? error.cause.code : error.code;
    if (errorCode === 'INTERNAL_SERVER_ERROR') {
      console.error(`[${ctx?.req.path ?? '??'}]`, error);
    }
    return {
      ...shape,
      // In prod, hide stack traces completely
      data: {
        ...shape.data,
        stack: config.env === 'dev' ? shape.data.stack : undefined,
      },
      message:
        shape.message !== '' &&
        shape.message !== 'INTERNAL_SERVER_ERROR' &&
        (config.env === 'dev' || error.code !== 'INTERNAL_SERVER_ERROR')
          ? shape.message
          : "An unexpected error occurred (it's not you, it's us)",
    };
  },
});
export type TRPCContext = typeof t;

const router = t.router;
const authProcedure = createUserAuthenticationProcedure(t);

export const appRouter = t.router({
  algorithms: algorithmsRouter(router, authProcedure),
  backtesting: backtestingRouter(router, authProcedure),
  env: t.procedure.query(() => config.env),
  heartbeat: t.procedure.query(() => true),
  payments: paymentsRouter(router, authProcedure),
  sharing: sharingRouter(router, authProcedure),
  thisIsAnError: t.procedure.query(() => {
    throw {
      message: 'This is an error',
    };
  }),
  users: usersRouter(router, authProcedure),
});
export type AppRouter = typeof appRouter;
