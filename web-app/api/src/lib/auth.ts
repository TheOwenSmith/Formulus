import { betterAuth, type User } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { customSession } from 'better-auth/plugins';
import { config } from './config';
import { prisma } from './prisma';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    customSession(async ({ user, session }) => {
      const userWithoutImage: Omit<User, 'image'> = { ...user };
      delete userWithoutImage['image'];
      return { user: userWithoutImage, session };
    }),
  ],
  secret: config.getKey('BETTER_AUTH_SECRET'),
  socialProviders: {
    google: {
      clientId: config.getKey('GOOGLE_CLIENT_ID'),
      clientSecret: config.getKey('GOOGLE_CLIENT_SECRET'),
    },
  },
  trustedOrigins: config.getKey('CORS_ORIGIN').split(','),
});
