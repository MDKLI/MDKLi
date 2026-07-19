#!/bin/sh
set -e

echo "Running database migrations..."
npm run migrate

echo "Seeding database (if needed)..."
npm run seed 2>/dev/null || true

echo "Starting auth-service..."
exec "$@"
