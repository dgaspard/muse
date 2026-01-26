# Minimal Dockerfile for Next.js development/prototype
# Simplified build: install dependencies in builder stage so `next` is available for build
FROM node:20-alpine AS builder
WORKDIR /app
ARG API_ENDPOINT
ENV API_ENDPOINT=${API_ENDPOINT}
# Install only web app dependencies without workspace resolution to avoid npm workspaces issues in CI
COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm install --production=false --silent --no-audit --no-fund --legacy-peer-deps
COPY apps/web ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app .
EXPOSE 3000
CMD ["npm", "start"]
