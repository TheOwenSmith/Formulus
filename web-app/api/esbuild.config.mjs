import { build, context } from 'esbuild';

const args = process.argv.slice(2);
const isWatch = args.includes('--watch');

const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  sourcemap: 'inline',
  outfile: 'dist/index.js',
  external: ['node:*'],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  nodePaths: ['node_modules'],
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
