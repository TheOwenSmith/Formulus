/**
 * Replace api/node_modules with only runtime externals (see esbuild.lambda.config.mjs): `pg` +
 * `@prisma/client`. Installation runs inside `.lambda-runtime-deps/` so **package.json and
 * pnpm-lock.yaml in api/ are never modified**, avoiding frozen-lockfile mismatches in CI.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(__dirname, '..');
const pkgPath = path.join(apiRoot, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const prismaVer = pkg.dependencies?.['@prisma/client'];
const pgVer = pkg.dependencies?.pg;
if (prismaVer == null || pgVer == null) {
  throw new Error('package.json must list @prisma/client and pg in dependencies');
}

const isolateDir = path.join(apiRoot, '.lambda-runtime-deps');
const isolatePkg = {
  name: 'lambda-runtime-deps',
  private: true,
  packageManager: pkg.packageManager,
  dependencies: {
    '@prisma/client': prismaVer,
    pg: pgVer,
  },
};

fs.rmSync(isolateDir, { recursive: true, force: true });
fs.mkdirSync(isolateDir, { recursive: true });
fs.writeFileSync(path.join(isolateDir, 'package.json'), `${JSON.stringify(isolatePkg, null, 2)}\n`);

execSync('pnpm install --config.node-linker=hoisted --no-frozen-lockfile', {
  cwd: isolateDir,
  stdio: 'inherit',
  env: { ...process.env },
});

const nmTarget = path.join(apiRoot, 'node_modules');
const nmBuilt = path.join(isolateDir, 'node_modules');
fs.rmSync(nmTarget, { recursive: true, force: true });
fs.renameSync(nmBuilt, nmTarget);
fs.rmSync(isolateDir, { recursive: true, force: true });
