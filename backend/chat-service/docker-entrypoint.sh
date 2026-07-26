#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Running user sync..."
node scripts/sync-users.js

echo "Starting chat-service..."
exec "$@"
