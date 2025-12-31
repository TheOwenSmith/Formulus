import { createExpressMiddleware } from '@trpc/server/adapters/express';
import cors from 'cors';
import express from 'express';
import { config } from './lib/config';
import { appRouter, createContext } from './lib/trpc';

const app = express();

app.use(
  cors({
    origin: config.getKey('CORS_ORIGIN').split(','),
    credentials: true,
  }),
);

app.use(
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.listen(config.port!, () => {
  console.log(`Server is running on port ${config.port!}`);
});
