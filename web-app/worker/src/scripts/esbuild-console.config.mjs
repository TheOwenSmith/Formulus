import { build } from 'esbuild';

// Contain native code and cannot be bundled
const prismaExternals = ['@prisma/client', '@prisma/client/*', '@prisma/adapter-pg', 'pg'];

await build({
  entryPoints: ['./src/scripts/console.ts'],
  bundle: true,
  minify: true,
  sourcemap: true,
  outfile: './dist/console.js',
  external: ['node:*', '../shared/node_modules/*', ...prismaExternals],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  platform: 'node',
  target: 'node24',
  format: 'esm',
});
