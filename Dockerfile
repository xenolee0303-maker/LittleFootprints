# ── Build stage ──────────────────────────────────────────
FROM node:22-slim AS build

WORKDIR /build

# Fall back to compiling native dependencies when prebuilt binaries are unavailable.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Copy package files and install all dependencies
COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN npm install

# Copy source and build configs
COPY tsconfig.base.json ./
COPY packages/shared/src packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/
COPY packages/server/src packages/server/src
COPY packages/server/tsconfig.json packages/server/
COPY packages/web/src packages/web/src
COPY packages/web/tsconfig.json packages/web/
COPY packages/web/vite.config.ts packages/web/
COPY packages/web/index.html packages/web/
COPY packages/web/postcss.config.js packages/web/
COPY packages/web/tailwind.config.js packages/web/

RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/server
RUN npm run build --workspace=packages/web

# ── Production stage ─────────────────────────────────────
FROM node:22-slim

WORKDIR /app

# Copy only production deps (better-sqlite3 ships glibc prebuilds on slim)
COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && npm install --omit=dev --workspace=packages/server --workspace=packages/shared \
  && apt-get purge -y --auto-remove python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Copy built artifacts (server dist, shared dist, web dist)
COPY --from=build /build/packages/server/dist packages/server/dist
COPY --from=build /build/packages/shared/dist packages/shared/dist
COPY --from=build /build/packages/web/dist /app/web

# Data directory for SQLite persistence
RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV TZ=Asia/Shanghai
ENV DATABASE_PATH=/app/data/kid-study.db

EXPOSE 3002

CMD ["node", "packages/server/dist/index.js"]
