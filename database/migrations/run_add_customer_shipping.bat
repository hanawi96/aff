@echo off
echo Running migration: Add customer shipping fee...
node ../run-migration.js 032_add_customer_shipping_fee.sql
pause
