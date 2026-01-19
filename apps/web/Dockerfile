# Minimal Dockerfile for Next.js development/prototype
# Simplified build: install dependencies in builder stage so `next` is available for build
FROM node:20-alpine AS builder
WORKDIR /app
ARG API_ENDPOINT
ENV API_ENDPOINT=${API_ENDPOINT}
COPY package.json package-lock.json* ./
# Use npm install here since the app workspace may not have its own lockfile
RUN npm install --silent --no-audit --no-fund --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app .
EXPOSE 3000
CMD ["npm", "start"]
