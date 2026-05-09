import { build } from 'esbuild';
import { nodeExternalsPlugin } from 'esbuild-node-externals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Contain native code and cannot be bundled
const prismaExternals = ['@prisma/client', '@prisma/client/*', '@prisma/adapter-pg', 'pg'];

await build({
  entryPoints: [path.join(__dirname, 'src/lambda.ts')],
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  outfile: path.join(__dirname, 'dist/lambda.js'),
  minify: true,
  sourcemap: true,
  external: ['node:*', ...prismaExternals],
  plugins: [nodeExternalsPlugin()],
  alias: {
    '@api': path.join(__dirname, 'src'),
    '@shared': path.join(__dirname, '..', 'shared'),
  },
  logLevel: 'info',
});
