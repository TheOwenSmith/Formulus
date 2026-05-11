import { build, context } from 'esbuild';

const args = process.argv.slice(2);
const isWatch = args.includes('--watch');

// Contain native code and cannot be bundled
const prismaExternals = ['@prisma/client', '@prisma/client/*', '@prisma/adapter-pg', 'pg'];

const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  sourcemap: 'inline',
  outfile: 'dist/index.js',
  external: ['node:*', '../shared/node_modules/*', ...prismaExternals],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  platform: 'node',
  target: 'node24',
  format: 'esm',
};

if (!isWatch) {
  console.log('Building API...');
  await build(options);
} else {
  console.log('Watching API...');
  const ctx = await context(options);
  await ctx.watch();
}
