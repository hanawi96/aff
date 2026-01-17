@echo off
echo Running Address Learning Migration...
node run-migration.js 036_create_address_learning.sql
pause
