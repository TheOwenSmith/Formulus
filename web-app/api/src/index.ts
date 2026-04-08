import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { toNodeHandler } from 'better-auth/node';
import cors from 'cors';
import express from 'express';
import 'source-map-support/register.js';
import { auth } from './lib/auth';
import { config } from './lib/config';
import { appRouter, createContext } from './lib/trpc';

const app = express();

app.use(
  cors({
    origin: config.getKey('CORS_ORIGIN').split(','),
    credentials: true,
  }),
);

// Better Auth
app.all('/api/auth/*splat', toNodeHandler(auth));

// TRPC
app.use(
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

if (config.env === 'dev') {
  app.listen(config.port!, () => {
    console.log(`Server is running on port ${config.port!}`);
  });
}

export { app };
