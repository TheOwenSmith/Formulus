import type { AppRouter } from '@shared/worker';
import { QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';

export const queryClient = new QueryClient();

export const trpcPublicClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: import.meta.env.VITE_SERVER_URL,
    }),
  ],
});

export const trpcCredentialsClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: import.meta.env.VITE_SERVER_URL,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include',
        });
      },
    }),
  ],
});

export const trpcPublic = createTRPCOptionsProxy<AppRouter>({
  client: trpcPublicClient,
  queryClient,
});

export const trpcCredentials = createTRPCOptionsProxy<AppRouter>({
  client: trpcCredentialsClient,
  queryClient,
});
