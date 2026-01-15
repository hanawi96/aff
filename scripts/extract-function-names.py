#!/usr/bin/env python3
"""
Script to extract all function names from the extracted modules
Then remove them from orders.js
"""

import re
import os

# List of all extracted module files
module_files = [
    'public/assets/js/orders/orders-constants.js',
    'public/assets/js/orders/orders-utils.js',
    'public/assets/js/orders/orders-ui-states.js',
    'public/assets/js/orders/orders-pagination.js',
    'public/assets/js/orders/orders-sorting.js',
    'public/assets/js/orders/orders-stats.js',
    'public/assets/js/orders/orders-filters.js',
    'public/assets/js/orders/orders-bulk-actions.js',
    'public/assets/js/orders/orders-export-history.js',
    'public/assets/js/orders/orders-table.js',
    'public/assets/js/orders/orders-status.js',
    'public/assets/js/orders/orders-profit-modal.js',
    'public/assets/js/orders/orders-detail-modal.js',
    'public/assets/js/orders/orders-products-display.js',
    'public/assets/js/orders/orders-ctv-modal.js'
]

# Extract all function names from modules
all_functions = set()
all_constants = set()

print("📋 Extracting function names from modules...\n")

for module_file in module_files:
    if not os.path.exists(module_file):
        print(f"⚠️  File not found: {module_file}")
        continue
    
    with open(module_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find function declarations
    # Pattern 1: function functionName(
    functions = re.findall(r'^(?:async\s+)?function\s+(\w+)\s*\(', content, re.MULTILINE)
    
    # Pattern 2: const functionName = function(
    const_functions = re.findall(r'^const\s+(\w+)\s*=\s*(?:async\s+)?function\s*\(', content, re.MULTILINE)
    
    # Pattern 3: const CONSTANT_NAME = {
    constants = re.findall(r'^const\s+([A-Z_]+)\s*=\s*\{', content, re.MULTILINE)
    
    module_name = os.path.basename(module_file)
    found = functions + const_functions
    
    if found:
        print(f"✅ {module_name}: {len(found)} functions")
        for func in found:
            print(f"   - {func}")
            all_functions.add(func)
    
    if constants:
        print(f"   Constants: {', '.join(constants)}")
        all_constants.update(constants)

print(f"\n📊 Total unique functions found: {len(all_functions)}")
print(f"📊 Total constants found: {len(all_constants)}")

# Save to file for reference
with open('scripts/extracted-functions-list.txt', 'w', encoding='utf-8') as f:
    f.write("FUNCTIONS:\n")
    for func in sorted(all_functions):
        f.write(f"{func}\n")
    f.write("\nCONSTANTS:\n")
    for const in sorted(all_constants):
        f.write(f"{const}\n")

print(f"\n✅ Function list saved to: scripts/extracted-functions-list.txt")
print(f"\n🔍 Functions to remove from orders.js:")
print(sorted(all_functions))
