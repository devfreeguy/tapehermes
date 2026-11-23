# syntax=docker/dockerfile:1.7
# TapeHermes backend (the repo root package only). Targets: migrator, api. Multi-platform (amd64, arm64).
ARG NODE_IMAGE=node:24-bookworm-slim

# ---- base: Node plus pnpm pinned through corepack at build time. The cache is owned by the runtime user. ----
FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION=11.15.1
ENV COREPACK_HOME=/opt/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=true
# openssl: the slim image has none, and Prisma then downloads the wrong (1.1.x) schema engine at build time.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /opt/corepack /app \
 && corepack enable \
 && corepack prepare "pnpm@${PNPM_VERSION}" --activate \
 && chown -R node:node /opt/corepack /app
WORKDIR /app
USER node

# ---- manifests: only what `pnpm install --frozen-lockfile` needs. dashboard and public-site contribute their package.json only. ----
FROM base AS manifests
COPY --chown=node:node package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --chown=node:node vendor ./vendor
COPY --chown=node:node dashboard/package.json ./dashboard/package.json
COPY --chown=node:node public-site/package.json ./public-site/package.json

# ---- builder: full install, prisma generate, nest build ----
FROM manifests AS builder
RUN pnpm install --frozen-lockfile --filter tapehermes
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node prisma.config.ts nest-cli.json tsconfig.json tsconfig.build.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node proofs ./proofs
# prisma generate only reads the schema, but prisma.config.ts insists on DATABASE_URL. A dummy value, for this one command only.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm build

# ---- migrator: runs `prisma migrate deploy` from the baked-in node_modules. No pnpm, corepack or install at runtime.
# NODE_ENV is not set to production here on purpose (the CLI is a devDependency). DATABASE_URL comes from --env-file. ----
FROM builder AS migrator
ENV CI=true \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1
WORKDIR /app
ENTRYPOINT ["/app/node_modules/.bin/prisma", "migrate", "deploy"]

# ---- prod-deps: production dependencies only ----
FROM manifests AS prod-deps
# autoInstallPeers (set in the lockfile) also installs the optional peers of @prisma/client (the prisma CLI, its studio, typescript)
# into node_modules/.pnpm. The service never loads them (it uses the generated client with @prisma/adapter-pg), so they are removed.
# Their dangling links are harmless. The image build is checked by running the service and its /health.
RUN pnpm install --prod --frozen-lockfile --filter tapehermes \
 && cd node_modules/.pnpm \
 && rm -rf prisma@* @prisma+studio-core@* @prisma+dev@* @prisma+config@* @prisma+engines@* @prisma+engines-version@* typescript@*

# ---- api: the running service. No pnpm, no corepack, no devDependencies, no sources, no secrets. ----
FROM ${NODE_IMAGE} AS api
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3006
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3006
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3006/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/src/main.js"]
