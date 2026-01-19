#!/bin/bash

# Run migration 045 to remove TEXT timestamp columns from products table

echo "Running migration 045: Remove TEXT timestamp columns from products..."
echo ""

# Get the database name from environment or use default
TURSO_DB_NAME=${TURSO_DB_NAME:-shopvd-db}

echo "Database: $TURSO_DB_NAME"
echo ""

# Execute the migration
turso db shell "$TURSO_DB_NAME" < 045_remove_text_timestamps_from_products.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration 045 completed successfully!"
else
    echo ""
    echo "❌ Migration failed"
    exit 1
fi
