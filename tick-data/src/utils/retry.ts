import { sleep } from './misc';

/**
 * Retry a synchronous function with immediate retries (no backoff delay)
 * @param fn - Synchronous function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @returns The result of the function
 */
export async function retryWithBackoffSync<T>(
  fn: () => T,
  maxRetries = 3,
  initialDelayMs = 1000,
  maxDelayMs = 30000,
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const exponentialDelay = initialDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * 1000; // Random 0-1000ms
      const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

      console.log(`  ⚠ Attempt ${attempt + 1} failed. Retrying in ${Math.round(delay)}ms...`);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Retry an async function with exponential backoff
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param initialDelayMs - Initial delay in milliseconds (default: 1000)
 * @param maxDelayMs - Maximum delay in milliseconds (default: 30000)
 * @returns Promise with the result of the function
 */
export async function retryWithBackoffAsync<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 1000,
  maxDelayMs = 30000,
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const exponentialDelay = initialDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * 1000; // Random 0-1000ms
      const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

      console.log(`  ⚠ Attempt ${attempt + 1} failed. Retrying in ${Math.round(delay)}ms...`);
      await sleep(delay);
    }
  }

  throw lastError;
}
