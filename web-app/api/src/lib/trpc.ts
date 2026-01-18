import { createUserAuthenticationProcedure } from '@api/middleware/authentication';
import { algorithmsRouter } from '@api/routes/algorithms';
import { backtestingRouter } from '@api/routes/backtesting';
import { usersRouter } from '@api/routes/users';
import { initTRPC, type TRPC_ERROR_CODE_KEY } from '@trpc/server';
import { type CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { config } from './config';

export const createContext = (x: CreateExpressContextOptions) => x;
export type Context = Awaited<ReturnType<typeof createContext>>;

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

const router = t.router;
const authProcedure = createUserAuthenticationProcedure(t);

export const appRouter = t.router({
  algorithms: algorithmsRouter(router, authProcedure),
  backtesting: backtestingRouter(router, authProcedure),
  env: t.procedure.query(() => config.env),
  heartbeat: t.procedure.query(() => true),
  users: usersRouter(router, authProcedure),
});
export type AppRouter = typeof appRouter;

export class ErrorWithCode extends Error {
  code: TRPC_ERROR_CODE_KEY;
  constructor(input: unknown, code: TRPC_ERROR_CODE_KEY) {
    const message = input instanceof Error ? input.message : String(input);
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}
