import type { Context } from '@api/lib/trpc';

export function parseCookies(ctx: Context): Record<string, string> {
  const cookies: Record<string, string> =
    ctx.req.headers.cookie?.split('; ').reduce((acc: Record<string, string>, line: string) => {
      const [key, value] = line.split('=', 2);
      acc[key] = value;
      return acc;
    }, {}) ?? {};
  return cookies;
}
