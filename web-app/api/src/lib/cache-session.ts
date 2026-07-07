import type { UserModel } from '@shared/generated/prisma/models';
import { fromThrowable, fromThrowableAsync, internal } from '@shared/utils/error-handling';
import { redis } from './redis';

const SESSION_CACHE_TTL_SECONDS = 30;

type Stored = { expiresAt: string; user: UserModel };

function key(token: string) {
  return `session:${token}`;
}

export type CachedSession = { expiresAt: Date; user: UserModel };

export async function getCachedSession(token: string): Promise<CachedSession | null> {
  const getResult = await fromThrowableAsync(
    () => redis.get(key(token)),
    (e) => internal(e, 'Redis get failed'),
  );
  if (getResult.isErr()) return null;
  if (getResult.value == null) return null;

  const parseResult = fromThrowable(
    () => JSON.parse(getResult.value!) as Stored,
    (e) => internal(e, 'Redis parse failed'),
  );
  if (parseResult.isErr()) return null;

  const { expiresAt, user } = parseResult.value;
  return { expiresAt: new Date(expiresAt), user };
}

export async function setCachedSession(token: string, data: CachedSession): Promise<void> {
  const payload: Stored = { expiresAt: data.expiresAt.toISOString(), user: data.user };
  await fromThrowableAsync(
    () => redis.set(key(token), JSON.stringify(payload), 'EX', SESSION_CACHE_TTL_SECONDS),
    (e) => internal(e, 'Redis set failed'),
  );
}

export async function deleteCachedSession(token: string): Promise<void> {
  await fromThrowableAsync(
    () => redis.del(key(token)),
    (e) => internal(e, 'Redis del failed'),
  );
}
