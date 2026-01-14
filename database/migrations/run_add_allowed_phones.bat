@echo off
echo Running migration: Add allowed_customer_phones column
node ../run-turso-migration.js 034_add_allowed_customer_phones.sql
pause
