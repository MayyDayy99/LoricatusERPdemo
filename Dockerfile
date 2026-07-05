# =============================================================
# apps/web/Dockerfile — Production multi-stage build
# Build context: repo root (run: docker build -f apps/web/Dockerfile .)
# Uses Next.js standalone output for minimal runtime image.
# =============================================================

# ---- Stage 1: install all workspace dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json ./
COPY apps/web/package.json ./apps/web/
# Include other workspace manifests so yarn doesn't error on missing workspaces
COPY apps/api/package.json    ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY packages/domain/package.json              ./packages/domain/
COPY packages/providers/package.json           ./packages/providers/
COPY packages/infra-azure-storage/package.json ./packages/infra-azure-storage/
COPY packages/infra-pdf/package.json           ./packages/infra-pdf/
COPY packages/infra-google-maps/package.json   ./packages/infra-google-maps/
COPY packages/infra-sendgrid/package.json      ./packages/infra-sendgrid/
COPY packages/infra-notam/package.json         ./packages/infra-notam/
COPY packages/infra-sketchfab/package.json     ./packages/infra-sketchfab/
COPY yarn.lock ./
COPY scripts/ ./scripts/

RUN yarn config set network-timeout 300000 -g && \
		for i in 1 2 3; do \
			yarn install --non-interactive --frozen-lockfile && exit 0; \
			echo "yarn install failed (attempt $i/3), retrying in 10s..."; \
			sleep 10; \
		done; \
		echo "yarn install failed after 3 attempts"; \
		exit 1

# ---- Stage 2: build Next.js app ----
FROM deps AS builder
WORKDIR /app

# Copy web source
COPY apps/web/src        ./apps/web/src
COPY apps/web/public     ./apps/web/public
COPY apps/web/messages   ./apps/web/messages
COPY apps/web/next.config.js      ./apps/web/next.config.js
COPY apps/web/tsconfig.json       ./apps/web/tsconfig.json
COPY apps/web/postcss.config.js   ./apps/web/
COPY apps/web/tailwind.config.js  ./apps/web/

# Copy other tsconfigs needed by workspaces to avoid yarn errors
COPY tsconfig.base.json ./

# Next.js collects anonymous telemetry — disable in CI/prod builds
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# NEXT_PUBLIC_* vars must be available at build time — pass via --build-arg
ARG NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DEFAULT_TENANT_ID=
ENV NEXT_PUBLIC_DEFAULT_TENANT_ID=$NEXT_PUBLIC_DEFAULT_TENANT_ID

WORKDIR /app/apps/web
RUN yarn build

# ---- Stage 3: production runtime ----
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache dumb-init
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Baked-in deployment version (git tag, e.g. v1.4.1). Read by the root layout
# at request time and rendered as a small badge. Runtime env still overrides.
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

# Next.js standalone bundle + static assets
COPY --from=builder --chown=appuser:appgroup /app/apps/web/.next/standalone ./
COPY --from=builder --chown=appuser:appgroup /app/apps/web/.next/static     ./apps/web/.next/static
COPY --from=builder --chown=appuser:appgroup /app/apps/web/public           ./apps/web/public

USER appuser

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
# Next.js standalone server.js is at the root of the standalone output
CMD ["node", "apps/web/server.js"]
