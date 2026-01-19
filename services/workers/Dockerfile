# Minimal Dockerfile for workers (TypeScript)
# Simplified build: install dependencies in the builder stage so devDependencies (tsc) are available
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
# Workers workspace may not have its own lockfile; use install to avoid ci failure
# Explicitly install including dev dependencies for TypeScript compilation
RUN npm install --production=false --silent --no-audit --no-fund --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/dist ./dist
# Copy production node_modules from the builder stage so runtime deps are present
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
RUN npm ci --production --silent || true
EXPOSE 4100
CMD ["node", "dist/worker.js"]
