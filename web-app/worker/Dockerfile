FROM node:24-bookworm-slim AS build

WORKDIR /repo

# Install pnpm
RUN corepack enable

# Copy only what we need for dependency install first (better caching)
COPY web-app/worker/package.json web-app/worker/pnpm-lock.yaml /repo/web-app/worker/

# Install dependencies for the worker package
RUN cd web-app/worker && pnpm install --frozen-lockfile

# Copy source code. Root tsconfig.json is required because the worker tsconfig extends it
# and esbuild needs the path aliases (@worker/*, @shared/*) defined there.
COPY web-app/tsconfig.json web-app/tsconfig.json
COPY web-app/shared/ web-app/shared/
COPY web-app/worker/ web-app/worker/

# Build worker bundle
RUN cd web-app/worker && pnpm run build

FROM node:24-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable

# Copy the built bundle and node_modules
COPY --from=build /repo/web-app/worker/dist ./dist
COPY --from=build /repo/web-app/worker/node_modules ./node_modules
COPY --from=build /repo/web-app/worker/package.json ./package.json

CMD ["node", "./dist/index.js"]
