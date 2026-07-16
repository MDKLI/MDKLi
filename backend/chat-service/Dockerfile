FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl=3.5.1-r0

COPY package*.json ./

RUN npm ci \
  && npx prisma generate

COPY prisma ./prisma/
COPY . .

RUN npm run build

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl=3.5.1-r0

COPY package*.json ./
COPY prisma ./prisma/
COPY scripts ./scripts/

RUN npm ci --only=production \
  && npx prisma generate

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3005

CMD ["sh", "-c", "node scripts/sync-users.js; exec node dist/app.js"]
