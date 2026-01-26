# Minimal Dockerfile for the API service (TypeScript)
# Simplified build: install dependencies in the builder stage so devDependencies (tsc) are available
FROM node:20-alpine AS builder
WORKDIR /app
# Install only API service dependencies without workspace resolution to avoid npm workspaces issues in CI
COPY services/api/package.json services/api/package-lock.json* ./
RUN npm install --production=false --silent --no-audit --no-fund --legacy-peer-deps
COPY services/api ./
# Copy prompts directory from repo root
COPY prompts ../prompts
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
# Install curl for healthcheck
RUN apk add --no-cache curl
COPY --from=builder /app/dist ./dist
# Copy production node_modules from the builder stage so runtime deps are present
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /prompts ../prompts
COPY package.json ./
# `npm ci --production` is retained as a fallback if any runtime deps are missing
RUN npm ci --production --silent || true
EXPOSE 4000
CMD ["node", "dist/index.js"]
