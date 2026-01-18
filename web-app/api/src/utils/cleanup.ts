import { tryAsync } from './error-handling';

export async function cleanup(fns: (() => unknown)[]) {
  const errors: unknown[] = [];
  for (const fn of fns) {
    const fnResponse = await tryAsync(() => fn());
    if (!fnResponse.ok) errors.push(fnResponse.error);
  }

  if (errors.length > 0) {
    throw new AggregateError(errors);
  }
}
