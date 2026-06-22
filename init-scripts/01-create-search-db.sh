#!/bin/bash
set -e

# Create search database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE searchdb;
    GRANT ALL PRIVILEGES ON DATABASE searchdb TO $POSTGRES_USER;
EOSQL

echo "✅ Search database created successfully"
