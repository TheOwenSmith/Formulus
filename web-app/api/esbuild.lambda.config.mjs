import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Native/binary only — `@prisma/adapter-pg` is bundled (pure JS). */
const prismaExternals = ['@prisma/client', '@prisma/client/*', 'pg'];

/**
 * Imports under ../worker/src walk up for node_modules and never reach ../api/node_modules.
 * nodePaths adds api/node_modules so zod, neverthrow, etc. resolve and are inlined by esbuild.
 */
const apiNodeModules = path.join(__dirname, 'node_modules');

await build({
  entryPoints: [path.join(__dirname, 'src/lambda.ts')],
  bundle: true,
  minify: true,
  sourcemap: 'inline',
  outfile: path.join(__dirname, 'dist/lambda.js'),
  external: ['node:*', '../shared/node_modules/*', ...prismaExternals],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  nodePaths: [apiNodeModules],
  logLevel: 'info',
  alias: {
    '@api': path.join(__dirname, 'src'),
    '@shared': path.join(__dirname, '..', 'shared'),
    '@worker': path.join(__dirname, '..', 'worker', 'src'),
  },
  platform: 'node',
  target: 'node24',
  format: 'esm',
});
