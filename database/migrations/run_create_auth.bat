@echo off
echo Running migration: Create auth tables...
npx wrangler d1 execute vdt --remote --file=database/migrations/033_create_auth_tables.sql
pause
