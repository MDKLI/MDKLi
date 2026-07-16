FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl=3.5.1-r0

COPY package*.json ./
COPY . .

RUN npm ci \
  && npx prisma generate \
  && npm run build

EXPOSE 3006

CMD ["npm", "start"]
