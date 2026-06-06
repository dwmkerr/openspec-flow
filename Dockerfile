# Multi-stage build. Builder produces dist/; runtime image carries
# only what's needed to `node dist/server.js`.

FROM node:22-slim AS builder
WORKDIR /app
# `npm ci` needs both package.json and the lockfile for a reproducible
# install. Copy them first so Docker caches the deps layer when only
# source changes.
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY tsconfig.json ./
COPY scripts/ ./scripts/
COPY src/ ./src/
COPY templates/ ./templates/
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
# Production-only install at runtime — smaller image, fewer attack
# surface bits than copying the builder's node_modules wholesale.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY templates/ ./templates/
# Probot needs PORT to bind on. Fly maps internal 3000 → external 443.
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.js"]
