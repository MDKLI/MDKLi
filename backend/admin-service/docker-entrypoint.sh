#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Seeding database (if needed)..."
npm run seed 2>/dev/null || true

echo "Starting admin-service..."
exec "$@"
