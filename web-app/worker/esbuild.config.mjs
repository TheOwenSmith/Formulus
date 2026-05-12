import { build, context } from 'esbuild';

const args = process.argv.slice(2);
const isWatch = args.includes('--watch');

// @api/* is not present in the Docker worker build (only shared/ + worker/ are copied).
// All @api imports in the shared layer are type-only and are erased by TypeScript
// transpilation, so stubbing them as empty modules is safe at runtime.
const apiStubPlugin = {
  name: 'api-stub',
  setup(build) {
    build.onResolve({ filter: /^@api\// }, () => ({
      namespace: 'api-stub',
      path: 'api-stub',
    }));
    build.onLoad({ filter: /.*/, namespace: 'api-stub' }, () => ({
      contents: '',
      loader: 'js',
    }));
  },
};

const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  sourcemap: 'inline',
  outfile: 'dist/index.js',
  // dockerode contains native code and cannot be bundled
  external: ['node:*', 'dockerode'],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  nodePaths: ['node_modules'],
  platform: 'node',
  target: 'node24',
  format: 'esm',
  plugins: [apiStubPlugin],
};

if (!isWatch) {
  console.log('Building worker...');
  await build(options);
} else {
  console.log('Watching worker...');
  const ctx = await context(options);
  await ctx.watch();
}
