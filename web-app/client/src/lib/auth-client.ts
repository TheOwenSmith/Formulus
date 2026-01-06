import { createAuthClient } from 'better-auth/react';

const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_SERVER_URL,
});

export const { useSession, signOut, signIn, signUp } = authClient;
