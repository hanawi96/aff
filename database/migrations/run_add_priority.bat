@echo off
echo Running migration: Add priority to orders...
node database\run-migration.js database\migrations\035_add_priority_to_orders.sql
pause
