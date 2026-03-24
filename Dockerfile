# Stage 1: Build frontend
FROM node:22-alpine AS frontend-build
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Install backend production deps with Bun (no native compilation needed)
FROM oven/bun:1 AS backend-deps
WORKDIR /app
COPY backend/package.json backend/bun.lock* ./
RUN bun install --production --trust-all-packages

# Stage 3: Final image — Bun runs TypeScript directly, no compile step needed
FROM oven/bun:1
WORKDIR /app

COPY --from=backend-deps /app/node_modules ./node_modules
COPY backend/src ./src

# Copy built frontend into the location the backend serves
COPY --from=frontend-build /build/frontend/dist ./public

ARG BUILD_VERSION=dev
ENV BUILD_VERSION=$BUILD_VERSION

EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
