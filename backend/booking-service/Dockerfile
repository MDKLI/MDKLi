# ---- Builder Stage ----
FROM node:24-alpine AS builder
WORKDIR /app

RUN apk update && apk add --no-cache openssl=3.5.7-r0

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma/
COPY . .
RUN npx prisma generate \
  && npm run build \
  && npm prune --production

# ---- Production Stage ----
FROM node:24-alpine
WORKDIR /app

RUN apk update && apk add --no-cache openssl=3.5.7-r0 \
  && addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

COPY docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh \
  && mkdir -p /app/logs \
  && chown -R appuser:appgroup /app

USER appuser
ENV NODE_ENV=production
EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3004/health || exit 1

CMD ["./docker-entrypoint.sh"]
