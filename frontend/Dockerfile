FROM node:26-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm i -g pnpm && pnpm install
COPY . .
RUN pnpm dlx @tanstack/router-cli generate
RUN pnpm build
EXPOSE 4173
CMD ["pnpm", "preview", "--host"]
