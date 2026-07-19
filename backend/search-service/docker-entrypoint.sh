#!/bin/sh
set -e

# Run migrations if the script exists (skip silently if not)
if npm run | grep -q " migrate"; then
  echo "Running database migrations..."
  npm run migrate
else
  echo "No migrate script found – skipping migrations."
fi

echo "Starting search-service..."
exec "$@"
