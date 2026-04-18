FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9.0.0

WORKDIR /app

COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/ai/package.json ./packages/ai/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/
COPY packages/queue/package.json ./packages/queue/
COPY packages/shared/package.json ./packages/shared/

# Hoist all deps to root node_modules so transitive imports resolve correctly
RUN echo "shamefully-hoist=true" > .npmrc
RUN pnpm install --no-frozen-lockfile

COPY apps/api ./apps/api
COPY packages ./packages

EXPOSE 3001
ENV NODE_ENV=production

CMD ["./node_modules/.bin/tsx", "apps/api/src/server.ts"]
