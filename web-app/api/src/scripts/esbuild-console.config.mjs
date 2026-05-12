import { build } from 'esbuild';

await build({
  entryPoints: ['./src/scripts/console.ts'],
  bundle: true,
  minify: true,
  sourcemap: true,
  outfile: './dist/console.js',
  external: ['node:*'],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  nodePaths: ['node_modules'],
  platform: 'node',
  target: 'node24',
  format: 'esm',
});
