#!/bin/sh
set -e

echo "Waiting for postgres to accept connections..."
until node -e "
const net = require('net');
const host = process.env.DB_HOST || 'postgres';
const port = process.env.DB_PORT || 5432;
const s = net.createConnection({ host, port });
s.on('connect', () => { s.end(); process.exit(0); });
s.on('error', () => process.exit(1));
"; do
  echo "  postgres not ready yet, retrying in 2s..."
  sleep 2
done
echo "postgres is accepting connections."

echo "Running database migrations..."
npx prisma migrate deploy

echo "Seeding database (if needed)..."
npm run seed 2>/dev/null || true

echo "Starting admin-service..."
exec "$@"
