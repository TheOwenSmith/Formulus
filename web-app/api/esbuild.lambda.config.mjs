import { build } from 'esbuild';

// Contain native code and cannot be bundled
const prismaExternals = ['@prisma/client', '@prisma/client/*', 'pg'];

await build({
  entryPoints: ['src/lambda.ts'],
  bundle: true,
  minify: true,
  sourcemap: 'inline',
  outfile: 'dist/lambda.js',
  external: ['node:*', '../shared/node_modules/*', ...prismaExternals],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  nodePaths: ['node_modules'],
  platform: 'node',
  target: 'node24',
  format: 'esm',
});
