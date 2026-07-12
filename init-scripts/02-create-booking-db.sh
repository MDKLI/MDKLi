#!/bin/bash
set -e

# Create booking database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE bookingdb;
    GRANT ALL PRIVILEGES ON DATABASE bookingdb TO $POSTGRES_USER;
EOSQL

echo "✅ Booking database created successfully"
