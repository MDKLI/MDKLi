FROM node:26-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:26-alpine
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production
EXPOSE 3000

# Run migrations and seed, then start the server
CMD ["sh", "-c", "npm run migrate && { npm run seed 2>/dev/null || true; } && exec npm start"]
