import { sleep } from './misc';
import { withCommas } from './number-utils';

export async function retryWithBackoff<T>({
  fn,
  maxRetries = 3,
  initialDelayMs = 1_000,
  maxDelayMs = 30_000,
  verboseLogging = false,
}: {
  fn: () => Promise<T>;
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  verboseLogging?: boolean;
}): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (verboseLogging) {
        console.error(error);
      }
      lastError = error;

      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const exponentialDelay = initialDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * 1000;
      const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

      if (verboseLogging) {
        console.log(
          `  ⚠ Attempt ${attempt + 1} failed. Retrying in ${withCommas(Math.round(delay))}ms...`,
        );
      }
      await sleep(delay);
    }
  }

  throw lastError;
}
