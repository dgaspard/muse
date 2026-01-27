# Minimal Dockerfile for Next.js development/prototype
# Simplified build: install dependencies in builder stage so `next` is available for build
FROM node:20-alpine AS builder
WORKDIR /app
ARG API_ENDPOINT
ENV API_ENDPOINT=${API_ENDPOINT}
# Install only web app dependencies without workspace resolution to avoid npm workspaces issues in CI
COPY package.json package-lock.json* ./
RUN npm install --production=false --silent --no-audit --no-fund --legacy-peer-deps
COPY . ./
# Debug: Print API_ENDPOINT to verify it's set during build
RUN echo "Building with API_ENDPOINT=${API_ENDPOINT}"
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Preserve API_ENDPOINT from build stage (needed for Next.js rewrites at runtime)
ARG API_ENDPOINT
ENV API_ENDPOINT=${API_ENDPOINT}
COPY --from=builder /app .
EXPOSE 3000
CMD ["npm", "start"]
