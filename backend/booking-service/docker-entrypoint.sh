#!/bin/sh
set -e
echo "Starting booking-service..."
exec node dist/app.js
