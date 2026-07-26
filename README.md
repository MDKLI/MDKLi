# Run MDKLi locally

## 1. Save this as `docker-compose.yml`

```yaml
version: '3.8'

services:
  auth-service:
    image: ghcr.io/mdkli/mdkli-auth-service:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: "3000"
      DB_HOST: postgres
      DB_PORT: "5432"
      DB_USERNAME: postgres
      DB_PASSWORD: postgres
      DB_NAME: authdb
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/authdb
      JWT_SECRET: your-super-secret-jwt-key-change-in-production
      REFRESH_SECRET: your-super-secret-refresh-key-change-in-production
      MINIO_ENDPOINT: minio
      MINIO_PORT: "9000"
      MINIO_PUBLIC_ENDPOINT: localhost
      MINIO_PUBLIC_PORT: "9000"
      MINIO_USE_SSL: "false"
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
      MINIO_BUCKET_NAME: mdkli-media
      RABBITMQ_URL: amqp://admin:admin@rabbitmq:5672
      FRONTEND_URL: http://localhost:80
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    networks:
      - app-network

  search-service:
    image: ghcr.io/mdkli/mdkli-search-service:latest
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: production
      PORT: "3001"
      DB_HOST: postgres
      DB_PORT: "5432"
      DB_USERNAME: postgres
      DB_PASSWORD: postgres
      DB_NAME: searchdb
      JWT_SECRET: your-super-secret-jwt-key-change-in-production
      MEILI_HOST: http://meilisearch:7700
      MEILI_API_KEY: masterKey
      AUTH_SERVICE_URL: http://auth-service:3000
      BOOKING_SERVICE_URL: http://booking-service:3004
      RABBITMQ_URL: amqp://admin:admin@rabbitmq:5672
    depends_on:
      postgres:
        condition: service_healthy
      meilisearch:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    networks:
      - app-network

  booking-service:
    image: ghcr.io/mdkli/mdkli-booking-service:latest
    restart: unless-stopped
    ports:
      - "3004:3004"
    environment:
      NODE_ENV: production
      PORT: "3004"
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/bookingdb
      REDIS_URL: redis://redis:6379
      RABBITMQ_URL: amqp://admin:admin@rabbitmq:5672
      LOG_LEVEL: info
      JWT_SECRET: your-super-secret-jwt-key-change-in-production
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    networks:
      - app-network

  chat-service:
    image: ghcr.io/mdkli/mdkli-chat-service:latest
    restart: unless-stopped
    ports:
      - "3005:3005"
    environment:
      NODE_ENV: production
      PORT: "3005"
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/chatdb
      RABBITMQ_URL: amqp://admin:admin@rabbitmq:5672
      JWT_SECRET: your-super-secret-jwt-key-change-in-production
      MINIO_ENDPOINT: minio
      MINIO_PORT: "9000"
      MINIO_PUBLIC_ENDPOINT: localhost
      MINIO_PUBLIC_PORT: "9000"
      MINIO_USE_SSL: "false"
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
      MINIO_BUCKET_NAME: mdkli-media
      LOG_LEVEL: info
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
      minio:
        condition: service_healthy
    networks:
      - app-network

  admin-service:
    image: ghcr.io/mdkli/mdkli-admin-service:latest
    restart: unless-stopped
    ports:
      - "3006:3006"
    environment:
      NODE_ENV: production
      PORT: "3006"
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/admindb
      RABBITMQ_URL: amqp://admin:admin@rabbitmq:5672
      JWT_SECRET: your-super-secret-jwt-key-change-in-production
      AUTH_SERVICE_URL: http://auth-service:3000
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    networks:
      - app-network

  frontend:
    image: ghcr.io/mdkli/mdkli-frontend:latest
    restart: unless-stopped
    ports:
      - "80:4173"
    environment:
      NODE_ENV: production
      VITE_API_URL: http://localhost:3000
      VITE_SEARCH_API_URL: http://localhost:3001
      VITE_CHAT_API_URL: http://localhost:3005
      VITE_CHAT_SOCKET_URL: http://localhost:3005
    depends_on:
      - auth-service
      - search-service
    networks:
      - app-network

  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: authdb
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3

  minio-create-bucket:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c " /usr/bin/mc alias set myminio http://minio:9000
      minioadmin minioadmin; /usr/bin/mc mb
      myminio/mdkli-media || true; /usr/bin/mc policy set public
      myminio/mdkli-media; exit 0; "
    networks:
      - app-network

  meilisearch:
    image: getmeili/meilisearch:v1.6
    restart: unless-stopped
    ports:
      - "7700:7700"
    environment:
      MEILI_MASTER_KEY: masterKey
      MEILI_HTTP_ADDR: 0.0.0.0:7700
    volumes:
      - meilisearch_data:/meili_data
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7700/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  rabbitmq:
    image: rabbitmq:3.12-management-alpine
    restart: unless-stopped
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: admin
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  app-network:
    driver: bridge

volumes:
  postgres_data:
  minio_data:
  meilisearch_data:
  rabbitmq_data:
  redis_data:
```

## 2. Start it

```bash
docker compose up -d
```

## 3. Create the other databases (one-time)

```bash
docker compose exec postgres psql -U postgres -c "CREATE DATABASE searchdb;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE bookingdb;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE chatdb;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE admindb;"
docker compose restart search-service booking-service chat-service admin-service
```

## 4. Open it

http://localhost
