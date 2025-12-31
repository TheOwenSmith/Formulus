import { backtestingRouter } from '@api/routes/backtesting';
import { initTRPC } from '@trpc/server';
import { type CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { config } from './config';

export const createContext = (x: CreateExpressContextOptions) => x;
type Context = Awaited<ReturnType<typeof createContext>>;

export const t = initTRPC.context<Context>().create({
  errorFormatter({ shape }) {
    return {
      ...shape,
      // In prod, hide stack traces completely
      data: {
        ...shape.data,
        stack: config.env === 'dev' ? shape.data.stack : undefined,
      },
    };
  },
});
export type TRPCContext = typeof t;

export const appRouter = t.router({
  heartbeat: t.procedure.query(() => true),
  env: t.procedure.query(() => config.env),
  backtesting: backtestingRouter,
});
export type AppRouter = typeof appRouter;
