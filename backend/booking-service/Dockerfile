FROM node:26-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache openssl=3.5.1-r0

# Install dependencies (including dev dependencies for build)
COPY package*.json ./

# Copy prisma schema and source
COPY prisma ./prisma/
COPY . .

RUN npm ci \
  && npx prisma generate \
  && npm run build

# Production stage
FROM node:26-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache openssl=3.5.1-r0

# Install production dependencies only
COPY package*.json ./

# Copy prisma schema
COPY prisma ./prisma/

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy sync scripts + entrypoint
COPY scripts ./scripts
RUN chmod +x ./scripts/docker-entrypoint.sh

RUN npm ci --only=production \
  && npx prisma generate

# Expose port
EXPOSE 3004

# Start command
CMD ["./scripts/docker-entrypoint.sh"]
