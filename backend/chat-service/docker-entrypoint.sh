#!/bin/sh
set -e

echo "Running user sync..."
node scripts/sync-users.js

echo "Starting chat-service..."
exec "$@"
