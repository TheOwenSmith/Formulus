import { createUserAuthenticationProcedure } from '@api/middleware/authentication';
import { algorithmsRouter } from '@api/routes/algorithms';
import { backtestingRouter } from '@api/routes/backtesting';
import { usersRouter } from '@api/routes/users';
import { initTRPC } from '@trpc/server';
import { type CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { config } from './config';

export const createContext = (x: CreateExpressContextOptions) => x;
export type Context = Awaited<ReturnType<typeof createContext>>;

export const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error, ctx }) {
    if (error.code === 'INTERNAL_SERVER_ERROR') {
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
        config.env === 'dev' || error.code !== 'INTERNAL_SERVER_ERROR'
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
  thisIsAnError: t.procedure.query(() => {
    throw {
      message: 'This is an error',
    };
  }),
  users: usersRouter(router, authProcedure),
});
export type AppRouter = typeof appRouter;
