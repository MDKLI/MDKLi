#!/bin/sh
set -e

echo "Running data sync scripts..."
node scripts/sync-all-data.js || echo "sync-all-data.js failed or skipped"
node scripts/sync-branch-assignments.js || echo "sync-branch-assignments.js failed or skipped"

echo "Starting booking-service..."
exec node dist/app.js
