import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Single pin for pnpm: Lambda Docker bundle, CI workflows, and local Corepack
 * (`packageManager` in package.json files under `web-app/`).
 */
export const PNPM_VERSION = '9.15.4' as const;

const here = dirname(fileURLToPath(import.meta.url));
export const WEB_APP_ROOT = join(here, '..', '..', '..');
