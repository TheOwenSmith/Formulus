import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { toNodeHandler } from 'better-auth/node';
import cors from 'cors';
import express from 'express';
import 'source-map-support/register.js';
import { auth } from './lib/auth';
import { config } from './lib/config';
import { stripeWebhookHandler } from './lib/stripe-webhook';
import { appRouter, createContext } from './lib/trpc';

const app = express();

app.use(
  cors({
    origin: config.getKey('CORS_ORIGIN').split(','),
    credentials: true,
  }),
);

// Stripe webhook needs raw body — register before express.json()
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

if (config.env !== 'dev') {
  app.use(express.json({ limit: '10mb' }));
}

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
