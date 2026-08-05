# ---- Builder Stage ----
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS builder
WORKDIR /app

RUN apk update && apk add --no-cache openssl=3.5.7-r0

COPY package*.json ./
RUN npm ci

COPY src ./src
COPY photos ./photos
# prune dev deps if any
RUN npm prune --production

# ---- Production Stage ----
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd
WORKDIR /app

RUN apk update && apk add --no-cache openssl=3.5.7-r0 \
  && addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src ./src
COPY --from=builder /app/photos ./photos

RUN mkdir -p /app/data && chown -R appuser:appgroup /app
USER appuser
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
