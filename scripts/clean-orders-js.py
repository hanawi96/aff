#!/usr/bin/env python3
"""
Script to remove extracted functions from orders.js
This script removes all functions that have been extracted to separate modules
"""

import re

# Read the original orders.js file
with open('public/assets/js/orders.js', 'r', encoding='utf-8') as f:
    content = f.read()

print(f"📄 Original file size: {len(content)} characters, {len(content.splitlines())} lines")

# ============================================
# MODULE 1: orders-constants.js
# ============================================
print("\n🔧 Removing Module 1: orders-constants.js functions...")

# Remove COST_CONSTANTS
content = re.sub(
    r'// Cost constants\s*\nconst COST_CONSTANTS = \{[\s\S]*?\};',
    '// NOTE: COST_CONSTANTS moved to orders-constants.js',
    content,
    count=1
)

# Remove loadCurrentTaxRate
content = re.sub(
    r'// Load current tax rate from API\s*\nasync function loadCurrentTaxRate\(\) \{[\s\S]*?\n\}',
    '// NOTE: loadCurrentTaxRate() moved to orders-constants.js',
    content,
    count=1
)

# Remove calculateOrderTotals
content = re.sub(
    r'// Helper function to calculate order totals from items\s*\nfunction calculateOrderTotals\(order\) \{[\s\S]*?\n\}',
    '// NOTE: calculateOrderTotals() moved to orders-constants.js',
    content,
    count=1
)

# Remove calculateOrderProfit
content = re.sub(
    r'// Helper function to calculate order profit dynamically\s*\nfunction calculateOrderProfit\(order\) \{[\s\S]*?\n\}',
    '// NOTE: calculateOrderProfit() moved to orders-constants.js',
    content,
    count=1
)

# Remove updateOrderData
content = re.sub(
    r'// Helper function to update order data in both allOrdersData and filteredOrdersData\s*\nfunction updateOrderData\(orderId, updates\) \{[\s\S]*?\n\}',
    '// NOTE: updateOrderData() moved to orders-constants.js',
    content,
    count=1
)

# ============================================
# MODULE 2: orders-utils.js
# ============================================
print("🔧 Removing Module 2: orders-utils.js functions...")

# Remove debounce
content = re.sub(
    r'// Debounce function[\s\S]*?function debounce\(func, wait\) \{[\s\S]*?\n\}',
    '// NOTE: debounce() moved to orders-utils.js',
    content,
    count=1
)

# Remove copyToClipboard
content = re.sub(
    r'function copyToClipboard\(text\) \{[\s\S]*?\n\}',
    '// NOTE: copyToClipboard() moved to orders-utils.js',
    content,
    count=1
)

# Remove escapeHtml
content = re.sub(
    r'function escapeHtml\(text\) \{[\s\S]*?\n\}',
    '// NOTE: escapeHtml() moved to orders-utils.js',
    content,
    count=1
)

# Remove formatCurrency
content = re.sub(
    r'function formatCurrency\(amount\) \{[\s\S]*?\n\}',
    '// NOTE: formatCurrency() moved to orders-utils.js',
    content,
    count=1
)

# Remove formatWeightSize
content = re.sub(
    r'function formatWeightSize\(value\) \{[\s\S]*?\n\}',
    '// NOTE: formatWeightSize() moved to orders-utils.js',
    content,
    count=1
)

# Remove formatDateTime
content = re.sub(
    r'function formatDateTime\(dateString\) \{[\s\S]*?\n\}',
    '// NOTE: formatDateTime() moved to orders-utils.js',
    content,
    count=1
)

# Remove formatDateTimeSplit
content = re.sub(
    r'function formatDateTimeSplit\(dateString\) \{[\s\S]*?\n\}',
    '// NOTE: formatDateTimeSplit() moved to orders-utils.js',
    content,
    count=1
)

print(f"✅ After removing constants and utils: {len(content.splitlines())} lines")

# Write the cleaned content
with open('public/assets/js/orders.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\n✅ Cleaned file saved: {len(content)} characters, {len(content.splitlines())} lines")
print(f"📉 Removed approximately {9161 - len(content.splitlines())} lines")
