import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { config } from './config';
import { prisma } from './prisma';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  secret: config.getKey('BETTER_AUTH_SECRET'),
  socialProviders: {
    google: {
      clientId: config.getKey('GOOGLE_CLIENT_ID'),
      clientSecret: config.getKey('GOOGLE_CLIENT_SECRET'),
    },
  },
  trustedOrigins: config.getKey('CORS_ORIGIN').split(','),
});
