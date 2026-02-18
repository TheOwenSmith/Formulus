# Project Standards (must follow)

## Structure

- All client-side code must live in `/client`.
- All SVG paths must live in `/icons` (do not inline large SVG path data elsewhere).
- All files in /api must use kebab-case filenames.

## Styling

- Use Tailwind utility classes instead of writing CSS.
- Any styled components must match the app’s sleek, modern design language (clean spacing, subtle borders/shadows, consistent typography).

## Modularity

- Keep code modular. If a feature grows, create new files/folders.
- Prefer small focused components and reusable hooks/utilities.

## Data & API (tRPC + React Query)

- This project uses tRPC and React Query.
- For authenticated procedures (routes using auth middleware), use:
  - `useQuery(trpcCredentials.path.to.query.queryOptions())`
  - `useMutation(trpcCredentials.path.to.query.mutationOptions())`
- For public procedures (no auth middleware), use:
  - `useQuery(trpcPublic.path.to.query.queryOptions())`
  - `useMutation(trpcPublic.path.to.query.mutationOptions())`

## Error handling

### API & Worker (neverthrow)

- **Never use `try/catch`** — wrap all throwable operations with `fromThrowable` or `fromThrowableAsync` from `@api/utils/error-handling` (or `@worker/utils/error-handling` in worker code).
- Map errors to either `internal(e, message?)` (unexpected failures → `INTERNAL_SERVER_ERROR`) or `badRequest(message, e?)` (invalid input → `BAD_REQUEST`).
- Propagate errors with `if (result.isErr()) return err(result.error)` using neverthrow's `err()`.
- **Throwing is only acceptable at top-level tRPC route handlers.** Route handlers may `throw result.error` or `throw badRequest(...)` — tRPC's `errorFormatter` in `lib/trpc.ts` handles sanitization (strips stack traces and replaces internal messages in production).
- **Only throw `AppError`-shaped objects** — never `new TRPCError(...)` or `new Error(...)`. The formatter expects `AppError` and maps its `code` field to the HTTP status; throwing anything else bypasses that mapping.
- Use VSCode snippets (`err`, `errvoid`, `errfrom`, `terr`, `terrvoid`, `terrfrom`) for consistent formatting.

### Client (React)

- Handle mutation errors via the `onError` callback in `mutationOptions`.
- All user-visible errors must be surfaced via `toast.error()` from `sonner`.
- Route-level errors are handled by React Router's `errorElement` (see `router.tsx`).

## User-visible errors

- Use `toast.error()` for expected, user-facing errors.
- Unexpected/internal errors must be logged to the console and mapped to a generic user-safe message (the tRPC `errorFormatter` handles this automatically for API errors in production).

## Types

- Import shared API types from `@shared/api` (re-exports `AppRouter`, tickers, bars, etc.).
- Import shared worker types from `@shared/worker` (re-exports backtesting result types) — **never import this in worker code** (chains to API-only env vars).
- Do NOT import types directly from `@api/...` in client code.

## Name conventions

- All files in `/api` must use kebab-case filenames.
