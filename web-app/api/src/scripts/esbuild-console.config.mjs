import { build } from 'esbuild';
import { nodeExternalsPlugin } from 'esbuild-node-externals';

await build({
  entryPoints: ['./src/scripts/console.ts'],
  bundle: true,
  minify: true,
  sourcemap: true,
  outfile: './dist/console.js',
  external: ['node:*'],
  plugins: [nodeExternalsPlugin()],
  platform: 'node',
  target: 'node24',
  format: 'esm',
});
