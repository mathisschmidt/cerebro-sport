# syntax=docker/dockerfile:1

# Pinned to the major the app is developed against. better-sqlite3 compiles
# against a specific Node ABI, so the builder and the runtime must agree —
# change this in one place only.
ARG NODE_VERSION=24-bookworm-slim

# ---------------------------------------------------------------------------
# deps — production node_modules, including the compiled better-sqlite3
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# better-sqlite3 has no prebuild for every platform and npm may fall back to
# node-gyp, which needs a toolchain.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

# `--omit=dev` alone is not enough here, and the reason is not obvious.
#
# better-auth declares @sveltejs/kit, svelte, drizzle-kit, vitest and others as
# *optional peer* dependencies. Because this project also has them as
# devDependencies, npm treats the installed copies as satisfying a production
# peer and refuses to mark them dev — so `--omit=dev` prunes nothing and the
# runtime image ends up carrying vite, typescript and a build toolchain.
# `--omit=optional` is what actually drops them: 68 packages / 189 MB down to
# 17 / 76 MB. Verify with `npm ls --omit=dev --omit=peer --omit=optional`
# after changing dependencies.
RUN npm ci --omit=dev --omit=peer --omit=optional

# npm records native-install approvals in package.json under `allowScripts`,
# pinned to exact versions. If a dependency is bumped without re-approving,
# the module installs *unbuilt* and only fails when the app first opens the
# database. Fail here instead, where the message is obvious.
RUN node -e "new (require('better-sqlite3'))(':memory:').exec('create table t(a)'); console.log('better-sqlite3 ok')"

# ---------------------------------------------------------------------------
# build — the SvelteKit bundle
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS build
WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# The build imports server modules for analysis. It must not need real secrets
# to do that — see `assertProductionReady`, which defers the check to the first
# served request.
RUN npm run build

# ---------------------------------------------------------------------------
# runtime — only what it takes to serve
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app

ENV NODE_ENV=production \
	PORT=3000 \
	DATABASE_URL=/data/app.db \
	BODY_SIZE_LIMIT=2M

COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/build        ./build
# Migrations are applied at boot by `db/client.ts`, which reads this folder.
COPY drizzle                        ./drizzle
COPY package.json                   ./package.json
COPY scripts/backup.mjs             ./scripts/backup.mjs

# The database lives on a volume, owned by the unprivileged user the app runs as.
RUN mkdir -p /data && chown -R node:node /data /app
USER node

VOLUME ["/data"]
EXPOSE 3000

# No curl in a slim image, and none needed — Node has fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "build/index.js"]
