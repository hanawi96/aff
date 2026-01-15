#!/usr/bin/env python3
"""
Script to remove extracted functions from orders.js
This script removes all functions that have been extracted to separate module files
"""

import re

# Read the original file
with open('public/assets/js/orders.js', 'r', encoding='utf-8') as f:
    content = f.read()

# List of function names to remove (in order of appearance)
functions_to_remove = [
    'loadCurrentTaxRate',
    'calculateOrderTotals',
    'calculateOrderProfit', 
    'updateOrderData',
    'loadPackagingConfig',
    'calculatePackagingCost',
    'debounce',
    'copyToClipboard',
    'escapeHtml',
    'formatCurrency',
    'formatWeightSize',
    'formatDateTime',
    'formatDateTimeSplit',
    'showLoading',
    'hideLoading',
    'showTable',
    'showEmptyState',
    'showError',
    'renderPagination',
    'goToPage',
    'toggleDateSort',
    'toggleAmountSort',
    'updateDateSortIcon',
    'updateAmountSortIcon',
    'applySorting',
    'updateStats',
    'updateStatElement',
    'updateStatLabels',
    'filterOrdersData',
    'toggleStatusFilter',
    'selectStatusFilter',
    'selectDateFilterPreset',
    'showCustomDatePicker',
    'closeCustomDatePicker',
    'switchDateMode',
    'applyCustomDate',
    'clearCustomDate',
    'updateCustomDateLabel',
    'handleOrderCheckbox',
    'toggleSelectAll',
    'updateBulkActionsUI',
    'clearSelection',
    'bulkExport',
    'loadXLSXLibrary',
    'showBulkStatusMenu',
    'bulkUpdateStatus',
    'bulkDelete',
    'loadExportHistory',
    'updateExportHistoryBadge',
    'showExportHistoryModal',
    'renderExportItem',
    'closeExportHistoryModal',
    'downloadAndUpdateExport',
    'deleteExportFile',
    'renderOrdersTable',
    'createOrderRow',
    'getStatusBadge',
    'showStatusMenu',
    'updateOrderStatus',
    'quickUpdateStatus',
    'showProfitBreakdown',
    'formatProductsDisplay',
    'toggleProducts',
    'viewOrderDetail',
    'showOrderDetailModal',
    'closeOrderDetailModal',
    'formatProductsForModal',
    'showCollaboratorModal',
    'closeCollaboratorModal'
]

print(f"Original file size: {len(content)} characters")
print(f"Functions to remove: {len(functions_to_remove)}")

# Remove COST_CONSTANTS object
content = re.sub(
    r'// Cost constants\s*\nconst COST_CONSTANTS = \{[^}]+\};',
    '// NOTE: Constants moved to orders/orders-constants.js',
    content,
    flags=re.DOTALL
)

# For each function, find and remove it
for func_name in functions_to_remove:
    # Pattern to match function declaration and its body
    # Handles both regular and async functions
    pattern = rf'(//[^\n]*\n)?(async\s+)?function\s+{func_name}\s*\([^)]*\)\s*\{{[^{{}}]*(?:\{{[^{{}}]*\}}[^{{}}]*)*\}}'
    
    # Try to find the function
    matches = list(re.finditer(pattern, content, re.DOTALL))
    
    if matches:
        print(f"✓ Removing {func_name}")
        content = re.sub(pattern, '', content, flags=re.DOTALL)
    else:
        print(f"✗ Could not find {func_name}")

print(f"\nFinal file size: {len(content)} characters")
print(f"Removed: {len(content)} characters")

# Write the modified content
with open('public/assets/js/orders.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("\n✅ Done! File has been updated.")
