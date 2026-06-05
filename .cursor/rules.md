# Formulus — Cursor Guide

SaaS backtesting platform. Users write stock trading algorithms (JS/TS/Python/C++) and run backtests against historical market data.

## Monorepo Structure

```
web-app/
├── api/        Express + tRPC server, port 3000
├── client/     React + Vite frontend, port 4040
├── infra/      AWS CDK infrastructure (Lambda, API Gateway, Amplify, SQS, ECS)
├── worker/     Node.js job processor (SQS → Docker containers)
└── shared/     Shared types, Prisma schema, re-exports
```

## Path Aliases

| Alias       | Resolves to    |
| ----------- | -------------- |
| `@api/*`    | `api/src/*`    |
| `@worker/*` | `worker/src/*` |
| `@shared/*` | `shared/*`     |
| `@client/*` | `client/src/*` |

## Key Technologies

- **API**: Express, tRPC v11, PostgreSQL via Prisma, better-auth
- **Client**: React 19, Vite, TanStack Query, tRPC client, React Router v7, Tailwind CSS v4, Sonner (toasts), Zustand, D3
- **Worker**: Node.js, Dockerode, AWS SQS (`@aws-sdk/client-sqs`)
- **Queue**: AWS SQS — LocalStack for local dev (`docker-compose`)
- **Infra**: AWS CDK, Lambda, API Gateway, Amplify Hosting, SQS, ECS/Fargate
- **Error handling**: `neverthrow` (API + Worker)

## Dev Commands

Run from each package directory:

```bash
# API
pnpm dev           # esbuild watch + nodemon
pnpm build         # esbuild production bundle
pnpm prisma:generate
pnpm prisma:migrate

# Client
pnpm start         # Vite dev server
pnpm build         # tsc + vite build

# Linting (all packages)
pnpm lint
pnpm prettier:write
```

## Prisma

Schema lives at `shared/prisma/schema.prisma`. Generated client outputs to `shared/generated/prisma/` (gitignored). Always run Prisma CLI from `api/` using the package scripts -- they pass the correct `--schema` flag.

The schema uses `engineType = "client"` (Prisma 7's pure-JS query engine). There are no native binaries. All Prisma dependencies (`@prisma/client`, `@prisma/adapter-pg`, `pg`) are bundled by esbuild into the output -- they are **not** externalized.

## Critical Import Rule

**Never import from `@api/*` in worker code.** This chains to `@api/lib/config`, which validates API-only environment variables and crashes the worker at runtime. The worker has its own standalone Prisma client at `worker/src/lib/prisma.ts`.

**Never import `@shared/api` from worker code** — it re-exports `AppRouter` which chains to `@api/lib/trpc`.

## Environment Variables

**Never read `process.env` directly.** All env access goes through the typed `Config` singleton:

```ts
import { config } from "@api/lib/config"; // in API code
import { config } from "@worker/lib/config"; // in worker code
import { config } from "@/lib/config"; // in infra code

const value = config.getKey("MY_KEY");
```

`config.getKey()` only accepts keys declared in `envVars`, giving compile-time safety. The singleton validates all declared keys are present on startup — the process fails fast if any are missing.

### Adding a new environment variable

Both steps are required:

1. **Add the key to `envVars`** in `api/src/lib/config.ts` and/or `worker/src/lib/config.ts`.
2. **Append it to `.env.sample`** in the same package directory: `MY_ENV_VAR=`

If parsing or casting is needed, add a getter to `Config` (e.g. `config.port`) rather than doing it at call sites.

> The worker has its own `envVars` list -- do not import `@api/lib/config` from worker code (see Critical Import Rule).

> Infra uses a `DEPLOY_TARGET` env var (`api`, `client`, or `worker`) to validate only the relevant subset of env vars during CDK synthesis. Set `DEPLOY_TARGET` in CI workflow env.

## Error Handling

### API & Worker (neverthrow)

All potentially-throwing operations must be wrapped — **never use bare `try/catch`**.

```ts
import {
  fromThrowable,
  fromThrowableAsync,
  internal,
  badRequest,
} from "@api/utils/error-handling";
// or '@worker/utils/error-handling' in worker code

// Async operation that may throw:
const result = await fromThrowableAsync(
  () => prisma.algorithm.findMany({ where: { creatorId: user.id } }),
  (e) => internal(e, "Failed to load algorithms"),
);
if (result.isErr()) return err(result.error);
const algorithms = result.value;

// Sync operation that may throw:
const parsed = fromThrowable(
  () => JSON.parse(rawString),
  (e) => badRequest("Invalid JSON", e),
);
if (parsed.isErr()) return err(parsed.error);
```

**Error constructors** (from `@api/utils/error-handling`):

- `internal(error, message?)` → `INTERNAL_SERVER_ERROR` — for unexpected failures
- `badRequest(message, error?)` → `BAD_REQUEST` — for invalid input or not-found

**AppError type**:

```ts
type AppError = {
  code: TRPC_ERROR_CODE_KEY;
  message?: string;
  error?: unknown;
};
```

**Only ever throw `AppError`-shaped objects** — never `new TRPCError(...)` or `new Error(...)`. The tRPC error formatter expects `AppError` and maps its `code` field to the correct HTTP status. Throwing anything else bypasses that mapping and produces unexpected behavior.

**Top-level tRPC routes are the only place where `throw` is acceptable.** Route handlers can `throw result.error` or `throw badRequest(...)` directly — tRPC's `errorFormatter` in `api/src/lib/trpc.ts` catches these and:

- Logs `INTERNAL_SERVER_ERROR` to console
- In production: replaces internal error messages with a generic user-safe string and strips stack traces
- In dev: preserves the original message and stack

Use `err()`/`ok()` from `neverthrow` to propagate errors through non-route code (repositories, utilities).

**VSCode snippets** (`.vscode/err-snippets.code-snippets`) provide `err`, `errvoid`, `errfrom`, `terr`, `terrvoid`, etc. — use these for consistent formatting.

### Client (React)

The client does not use neverthrow. Error handling on the client:

- **Mutations** — use `onError` callback in `mutationOptions`:
  ```tsx
  useMutation(
    trpcCredentials.users.updateProfile.mutationOptions({
      onError: (error) => {
        console.error("Failed to update profile:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to update. Please try again.",
        );
      },
    }),
  );
  ```
- **User-visible errors** — always surface via `toast.error()` (Sonner). Import: `import { toast } from 'sonner'`
- **Route-level errors** — React Router's `errorElement` handles loader failures (see `router.tsx`)
- **Auth errors** — `throw redirect('/login')` from loaders

## tRPC Usage in Client

For authenticated procedures (auth middleware applied):

```ts
useQuery(trpcCredentials.path.to.query.queryOptions());
useMutation(
  trpcCredentials.path.to.query.mutationOptions({ onError, onSuccess }),
);
```

For public procedures (no auth middleware):

```ts
useQuery(trpcPublic.path.to.query.queryOptions())
useMutation(trpcPublic.path.to.query.mutationOptions(...))
```

## Shared Types

Shared types live in `@shared/constants/*`, `@shared/schemas/*`, and `@shared/db/*` and are safe to import from API, worker, and client code. `@shared/api` is now only a single-export shim for `AppRouter` (the tRPC router type used to type the client) — do not use it for anything else. Do not import from `@api/*` or `@worker/*` directly in client code.

## Code Conventions

- **API filenames**: kebab-case (e.g., `error-handling.ts`, `db-algorithm.ts`)
- **Client filenames**: PascalCase for components (`.tsx`), camelCase for utilities/hooks (`.ts`)
- **SVG paths**: live in `client/src/icons/` — do not inline large path data elsewhere
- **Styling**: Tailwind utility classes only, no custom CSS unless unavoidable
- **Modularity**: keep components/hooks small and focused; split into new files as features grow
- **Em dashes**: never use `—` in code or comments; use `:`, `,`, or restructure the sentence

## Client UI Design System

Dark-glass aesthetic throughout. Key patterns:

- **Background**: `bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900`
- **Cards**: `bg-slate-900/60 rounded-2xl backdrop-blur-[10px] shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)]`
- **Text**: `text-white` / `text-white/70` / `text-white/50`; borders `border-white/10`
- **Gradient headings**: inline `style={{ backgroundImage: 'linear-gradient(to right, ...)' }}` + `bg-clip-text text-transparent` (cyan→blue→purple by default)
- **Buttons**: `rounded-xl px-6 py-3 border transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50`; fill color via `from-{color}-500/20 to-{color}-500/20` gradients
- **Accent colors**: blue/cyan (primary), purple/pink (secondary), emerald/teal (success), red/orange (danger)
- **Inputs**: `rounded-xl bg-white/5 border-white/10 focus:ring-2 focus:ring-blue-500/50`
- **Ambient orbs**: three pulsing `blur-3xl rounded-full` divs at fixed positions on full-page views
- **Entry animations**: `animate-[fadeInUp_0.8s_ease-out]`; max content width `max-w-[1400px] mx-auto`

When in doubt, read an existing page component — the patterns are highly consistent.

## Architecture & Infrastructure Decisions

**Always ask before making any architectural change.** Do not refactor infrastructure, change service boundaries, add new dependencies, or alter deployment topology without explicit developer approval.

When proposing or evaluating infrastructure options, **cost is the primary decision criterion** — optimize aggressively for the cheapest option that meets the requirements. Examples of the preferred direction:

| Prefer                      | Over                                |
| --------------------------- | ----------------------------------- |
| Lambda (pay-per-invocation) | EC2 / Fargate (always-on compute)   |
| SQS (managed queue, ~$0)    | Self-hosted RabbitMQ / Redis queues |
| RDS Aurora Serverless v2    | Always-on RDS instances             |
| CloudFront + S3 (static)    | EC2-served frontends                |
| API Gateway + Lambda        | ALB + ECS/Fargate                   |

When suggesting architecture, always call out the cost implication explicitly and default to the lower-cost path unless there is a clear technical reason otherwise.

## Backtest Flow

1. Client → `backtestAlgorithms({ algorithms: [{id}], timespan? })` mutation
2. API loads algorithms from DB, creates `BacktestingSubmission` (status=PENDING), snapshots algorithm versions, sends `{ submissionId }` to SQS
3. Worker receives SQS message → sets status=RUNNING → runs Docker containers → writes `BacktestingResults` → status=FINISHED
4. Client polls `getSubmissionStatus({ publicId })` until FINISHED, then fetches `getBacktestingResults({ publicId })`

## Key Files

| File                                     | Purpose                                                              |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `api/src/lib/trpc.ts`                    | tRPC init, `errorFormatter`, router wiring                           |
| `api/src/utils/error-handling.ts`        | `AppError`, `fromThrowable`, `internal`, `badRequest`                |
| `api/src/middleware/authentication.ts`   | Session validation middleware                                        |
| `api/src/routes/backtesting.ts`          | `backtestAlgorithms`, `getSubmissionStatus`, `getBacktestingResults` |
| `api/src/routes/algorithms.ts`           | `createAlgorithm`                                                    |
| `api/src/repository/db-submission.ts`    | `createSubmission`, `getSubmissionStatus`                            |
| `api/src/lib/sqs.ts`                     | SQS client                                                           |
| `api/src/lib/config.ts`                  | API `Config` singleton, typed env access                             |
| `worker/src/worker.ts`                   | Main SQS processing loop                                             |
| `worker/src/lib/prisma.ts`               | Worker's standalone PrismaClient                                     |
| `worker/src/lib/config.ts`               | Worker `Config` singleton, typed env access                          |
| `worker/src/repository/db-submission.ts` | Load/update submissions, AlgorithmVersion→UserAlgorithm conversion   |
| `worker/src/repository/db-results.ts`    | `createBacktestingResults`                                           |
| `shared/prisma/schema.prisma`            | Canonical Prisma schema                                              |
| `client/src/lib/trpc.ts`                 | tRPC client setup, `queryClient`, `trpcCredentials`, `trpcPublic`    |
| `client/src/router.tsx`                  | React Router config, auth guards                                     |
| `infra/bin/app.ts`                       | CDK app entry point, stack orchestration                             |
| `infra/lib/api-gateway-stack.ts`         | API Lambda + API Gateway stack, bundling shell                       |
| `infra/lib/amplify-stack.ts`             | Amplify Hosting stack (client deploy)                                |
| `infra/lib/config.ts`                    | Infra `Config` singleton, `DEPLOY_TARGET`-based env validation       |
