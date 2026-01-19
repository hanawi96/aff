#!/bin/bash

# Run migration to add used_at_unix column to discount_usage table

echo "🚀 Running migration: Add used_at_unix to discount_usage..."
turso db shell vdt < database/migrations/044_add_used_at_unix_to_discount_usage.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
else
    echo "❌ Migration failed!"
    exit 1
fi
