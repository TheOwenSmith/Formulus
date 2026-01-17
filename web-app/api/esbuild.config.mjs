import { build, context } from 'esbuild';
import { nodeExternalsPlugin } from 'esbuild-node-externals';

const args = process.argv.slice(2);
const isWatch = args.includes('--watch');

const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  sourcemap: true,
  outfile: 'dist/index.js',
  external: ['node:*'],
  plugins: [nodeExternalsPlugin()],
  platform: 'node',
  target: 'node24',
  format: 'esm',
};

if (!isWatch) {
  await build(options);
} else {
  const ctx = await context(options);
  await ctx.watch();
}
