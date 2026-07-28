#!/bin/sh
set -e

# Wait for postgres to actually accept TCP connections before doing anything.
# The container-level healthcheck can report "healthy" during Postgres's
# temporary single-user startup phase, before the real server is listening —
# so we confirm it ourselves instead of trusting that timing.
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

# Run migrations if the script exists (skip silently if not)
if npm run | grep -q " migrate"; then
  echo "Running database migrations..."
  npm run migrate
else
  echo "No migrate script found – skipping migrations."
fi

echo "Starting search-service..."
exec "$@"
