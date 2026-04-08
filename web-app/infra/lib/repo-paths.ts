import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Monorepo `web-app/` root, resolved from `infra/dist/lib/*.js` at runtime. */
const here = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = join(here, '..', '..', '..');
export const WEB_APP_ROOT = join(REPO_ROOT, 'web-app');
export const API_ROOT = join(WEB_APP_ROOT, 'api');
/** Prisma schema + generated client; `api` imports `@shared/*` from here. */
export const SHARED_ROOT = join(WEB_APP_ROOT, 'shared');
