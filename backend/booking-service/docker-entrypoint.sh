#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting booking-service..."
exec node dist/app.js
