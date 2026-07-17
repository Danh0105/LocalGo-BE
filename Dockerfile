# syntax=docker/dockerfile:1

# ---------- deps: install once, reused by build stage ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# ---------- build: compile TypeScript ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/generated ./generated
COPY . .
RUN npm run build

# ---------- production: only what's needed to run ----------
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S localgo && adduser -S localgo -G localgo

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/generated ./generated
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

RUN mkdir -p uploads && chown -R localgo:localgo /app

USER localgo

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3001/api/v1/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Runs pending migrations before starting the API — `migrate deploy` (not
# `migrate dev`) applies committed migrations without generating new ones or
# prompting, which is what a non-interactive container start needs.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
