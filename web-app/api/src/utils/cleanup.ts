import { Result } from 'neverthrow';
import { fromThrowableAsync, internal } from './error-handling';

export async function cleanup(
  fns: (() => void | Promise<void>)[],
): Promise<Result<void[], unknown>> {
  const results: Result<void, unknown>[] = [];
  for (const fn of fns) {
    const fnResult = await fromThrowableAsync(
      () => Promise.resolve(fn()),
      (e) => internal(e),
    );
    results.push(fnResult);
  }
  return Result.combine(results);
}
