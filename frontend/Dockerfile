# ---- Builder Stage ----
FROM node:24-alpine AS builder
WORKDIR /app

# Use pnpm v10 (no ERR_PNPM_IGNORED_BUILDS)
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Build with Vite directly – skips TypeScript type checking
RUN npx vite build

# ---- Production Stage ----
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4173/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
