# ---- Builder Stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY photos ./photos

# ---- Production Stage ----
FROM node:20-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src ./src
COPY --from=builder /app/photos ./photos
RUN mkdir -p /app/data && chown -R appuser:appgroup /app
USER appuser
CMD ["node", "src/index.js"]
