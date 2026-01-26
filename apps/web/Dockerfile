# Minimal Dockerfile for Next.js development/prototype
# Simplified build: install dependencies in builder stage so `next` is available for build
FROM node:20-alpine AS builder
WORKDIR /app
ARG API_ENDPOINT
ENV API_ENDPOINT=${API_ENDPOINT}
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package-lock.json* ./apps/web/
# Install workspaces including dev dependencies for Next.js build
RUN npm install --production=false --silent --no-audit --no-fund --legacy-peer-deps --workspaces
COPY apps/web ./apps/web
RUN npm run build --workspace=muse-web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app .
EXPOSE 3000
CMD ["npm", "start"]
