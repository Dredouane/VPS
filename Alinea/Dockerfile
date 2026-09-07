# HermesWeb — 1 seul service Cloud Run (front Next.js + API route handlers)
FROM node:22-alpine AS base
RUN corepack enable pnpm

FROM base AS build
WORKDIR /app
# .env.production (NEXT_PUBLIC_* build-time) est copié par deploy.sh avant build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json turbo.json ./
COPY apps/web/package.json apps/web/
COPY packages/ui/package.json packages/ui/
COPY packages/api-types/package.json packages/api-types/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @hermesweb/web build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
