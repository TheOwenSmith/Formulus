# Project Standards (must follow)

## Structure

- All client-side code must live in `/client`.
- All SVG paths must live in `/icons` (do not inline large SVG path data elsewhere).

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

- Do not use `try/catch`.
- Use `trySync` and `tryAsync` for error handling.
- Format errors exactly as defined in `err-snippets.code-snippet`.

## User-visible errors

- All user-visible errors must be surfaced via the standard toast system:
  - Use `toast()` for expected UI-facing errors.
- Unexpected or internal errors must be:
  - Logged to the logging system (X)
  - And mapped to a generic user-safe message.

## Types

- Import shared backend types exclusively from `@shared/types.ts`.
- Do NOT import types from `@api/shared/...`.
