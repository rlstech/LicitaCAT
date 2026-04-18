FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9.0.0

# ---- builder ----
FROM base AS builder
WORKDIR /app

COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

RUN echo "shamefully-hoist=true" > .npmrc
RUN pnpm install --no-frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY packages/auth ./packages/auth
COPY apps/web ./apps/web

ARG NEXT_PUBLIC_API_URL=https://api.licitacat.railton.eu.org
ARG NEXT_PUBLIC_BETTER_AUTH_URL=https://licitacat.railton.eu.org
# DATABASE_URL necessário para que o módulo @licitacat/auth inicialize sem erros
# (postgres conecta lazy — não haverá conexão real durante o build)
ARG DATABASE_URL=postgresql://licitacat:licitacat@postgres:5432/licitacat
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BETTER_AUTH_URL=$NEXT_PUBLIC_BETTER_AUTH_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @licitacat/web build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
