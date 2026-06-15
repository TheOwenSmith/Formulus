import type { UserModel } from '@shared/generated/prisma/models';
import { redis } from './redis';

const SESSION_CACHE_TTL_SECONDS = 30;

type Stored = { expiresAt: string; user: UserModel };

function key(token: string) {
  return `session:${token}`;
}

export type CachedSession = { expiresAt: Date; user: UserModel };

export async function getCachedSession(token: string): Promise<CachedSession | null> {
  try {
    const raw = await redis.get(key(token));
    if (raw == null) return null;
    const { expiresAt, user } = JSON.parse(raw) as Stored;
    return { expiresAt: new Date(expiresAt), user };
  } catch {
    return null;
  }
}

export async function setCachedSession(token: string, data: CachedSession): Promise<void> {
  try {
    const payload: Stored = { expiresAt: data.expiresAt.toISOString(), user: data.user };
    await redis.set(key(token), JSON.stringify(payload), 'EX', SESSION_CACHE_TTL_SECONDS);
  } catch {
    // non-fatal
  }
}

export async function deleteCachedSession(token: string): Promise<void> {
  try {
    await redis.del(key(token));
  } catch {
    // non-fatal
  }
}
