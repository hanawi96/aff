// Orders Export History Functions
// Extracted from orders.js for better code organization
// NOTE: All functions remain at global scope for backward compatibility

// ============================================
// CACHE VARIABLES
// ============================================
let exportHistoryCache = null;
let exportHistoryCacheTime = 0;
const CACHE_DURATION = 30000; // 30 seconds

// ============================================
// SELECTION STATE
// ============================================
let selectedExportIds = new Set();

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get empty state HTML (DRY - reusable)
 */
function getEmptyStateHTML() {
    return `
        <div class="text-center py-16">
            <div class="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <svg class="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Chưa có file export nào</h3>
            <p class="text-gray-500">Export đơn hàng để tạo file Excel đầu tiên</p>
        </div>
    `;
}

/**
 * Handle empty state after deletion
 */
function handleEmptyState() {
    const itemsContainer = document.querySelector('.space-y-3');
    if (itemsContainer && itemsContainer.children.length === 0) {
        itemsContainer.innerHTML = getEmptyStateHTML();
        // Hide bulk actions bar
        const bulkActionsBar = document.querySelector('.px-6.py-3.bg-gray-50');
        if (bulkActionsBar) bulkActionsBar.remove();
    }
}

/**
 * Load XLSX library dynamically
 */
function loadXLSXLibrary() {
    return new Promise((resolve, reject) => {
        if (typeof XLSX !== 'undefined') {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Không thể tải thư viện Excel'));
        document.head.appendChild(script);
    });
}

// ============================================
// LOAD EXPORT HISTORY
// ============================================

/**
 * Load export history with caching
 */
async function loadExportHistory(forceRefresh = false) {
    const now = Date.now();
    
    // Return cache if valid and not forcing refresh
    if (!forceRefresh && exportHistoryCache && (now - exportHistoryCacheTime < CACHE_DURATION)) {
        return exportHistoryCache;
    }
    
    // Fetch fresh data
    const response = await fetch(`${CONFIG.API_URL}?action=getExportHistory&timestamp=${now}`);
    const data = await response.json();
    
    if (data.success) {
        exportHistoryCache = data;
        exportHistoryCacheTime = now;
        return data;
    }
    
    throw new Error(data.error || 'Không thể tải lịch sử export');
}

/**
 * Update export history badge count
 */
async function updateExportHistoryBadge() {
    try {
        const data = await loadExportHistory();
        
        if (data.exports) {
            const pendingCount = data.exports.filter(exp => exp.status === 'pending').length;
            
            const badge = document.getElementById('exportHistoryBadge');
            if (badge) {
                if (pendingCount > 0) {
                    badge.textContent = pendingCount;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }
        }
    } catch (error) {
        console.error('Error updating export history badge:', error);
    }
}

// ============================================
// EXPORT HISTORY MODAL
// ============================================

/**
 * Show export history modal
 */
async function showExportHistoryModal() {
    try {
        // Reset selection
        selectedExportIds.clear();
        
        // Use cached data
        const data = await loadExportHistory();
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'exportHistoryModal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
                <!-- Header -->
                <div class="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                            <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-gray-900">Lịch sử Export</h2>
                            <p class="text-sm text-gray-600">Quản lý các file Excel đã export</p>
                        </div>
                    </div>
                    <button onclick="closeExportHistoryModal()" class="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-2 transition-colors">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <!-- Bulk Actions Bar -->
                ${data.exports.length > 0 ? `
                    <div class="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" id="selectAllExports" onchange="toggleSelectAllExports()" 
                                    class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                                <span class="text-sm font-medium text-gray-700">Chọn tất cả</span>
                            </label>
                            <span id="selectedCount" class="text-sm text-gray-500">0 đã chọn</span>
                        </div>
                        <div id="bulkActions" class="hidden flex items-center gap-2">
                            <button onclick="bulkMergeAndDownloadExports()" 
                                class="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                                Gộp & Tải
                            </button>
                            <button onclick="bulkDownloadExports()" 
                                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium flex items-center gap-2">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Tải từng file
                            </button>
                            <button onclick="bulkDeleteExports()" 
                                class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm font-medium flex items-center gap-2">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Xóa
                            </button>
                        </div>
                    </div>
                ` : ''}
                
                <!-- Content -->
                <div class="flex-1 overflow-y-auto p-6">
                    ${data.exports.length === 0 ? getEmptyStateHTML() : `
                        <div class="space-y-3">
                            ${data.exports.map(exp => renderExportItem(exp)).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('Error showing export history:', error);
        showToast('Không thể tải lịch sử export: ' + error.message, 'error');
    }
}

/**
 * Render single export item
 */
function renderExportItem(exp) {
    const date = new Date(exp.created_at);
    const dateStr = date.toLocaleString('vi-VN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit', 
        minute: '2-digit'
    });
    
    const statusBadge = exp.status === 'downloaded' 
        ? '<span class="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700 flex items-center gap-1"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>Đã tải</span>'
        : '<span class="px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>Chưa tải</span>';
    
    return `
        <div class="export-item flex items-center gap-3 p-4 border-2 ${exp.status === 'pending' ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200'} rounded-xl hover:shadow-md transition-all" data-export-item-id="${exp.id}">
            <!-- Checkbox -->
            <input type="checkbox" 
                class="export-checkbox w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer" 
                data-export-id="${exp.id}"
                onchange="toggleExportSelection(${exp.id})" />
            
            <div class="flex items-center justify-between flex-1">
                <div class="flex items-center gap-4 flex-1">
                    <!-- File Icon -->
                    <div class="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    
                    <!-- File Info -->
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <h3 class="font-semibold text-gray-900 truncate">${exp.file_name}</h3>
                            ${statusBadge}
                        </div>
                        <div class="flex items-center gap-3 text-sm text-gray-500">
                            <span class="flex items-center gap-1">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                ${dateStr}
                            </span>
                            <span class="flex items-center gap-1">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                ${exp.order_count} đơn hàng
                            </span>
                        </div>
                    </div>
                </div>
                
                <!-- Actions -->
                <div class="flex items-center gap-2 ml-4">
                    <button onclick="downloadAndUpdateExport(${exp.id})" 
                        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium flex items-center gap-2 hover:scale-105">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Tải xuống
                    </button>
                    <button onclick="deleteExportFile(${exp.id})" 
                        class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa file">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Close export history modal
 */
function closeExportHistoryModal() {
    console.log('🟣 [CLOSE_MODAL] Start closing...');
    const modal = document.getElementById('exportHistoryModal');
    if (modal) {
        console.log('🟣 [CLOSE_MODAL] Modal found, removing...');
        modal.remove();
        console.log('🟣 [CLOSE_MODAL] Modal removed');
        selectedExportIds.clear();
        console.log('🟣 [CLOSE_MODAL] Selection cleared');
    } else {
        console.log('🟣 [CLOSE_MODAL] Modal not found');
    }
    console.log('🟣 [CLOSE_MODAL] ✅ Completed');
}

// ============================================
// SELECTION FUNCTIONS
// ============================================

/**
 * Toggle single export selection
 */
function toggleExportSelection(exportId) {
    if (selectedExportIds.has(exportId)) {
        selectedExportIds.delete(exportId);
    } else {
        selectedExportIds.add(exportId);
    }
    updateSelectionUI();
}

/**
 * Toggle select all exports
 */
function toggleSelectAllExports() {
    const selectAllCheckbox = document.getElementById('selectAllExports');
    const checkboxes = document.querySelectorAll('.export-checkbox');
    
    if (selectAllCheckbox.checked) {
        // Select all
        checkboxes.forEach(cb => {
            const exportId = parseInt(cb.dataset.exportId);
            selectedExportIds.add(exportId);
            cb.checked = true;
        });
    } else {
        // Deselect all
        selectedExportIds.clear();
        checkboxes.forEach(cb => cb.checked = false);
    }
    
    updateSelectionUI();
}

/**
 * Update selection UI (count and bulk actions visibility)
 */
function updateSelectionUI() {
    const count = selectedExportIds.size;
    const selectedCountEl = document.getElementById('selectedCount');
    const bulkActionsEl = document.getElementById('bulkActions');
    const selectAllCheckbox = document.getElementById('selectAllExports');
    const totalCheckboxes = document.querySelectorAll('.export-checkbox').length;
    
    // Update count
    if (selectedCountEl) {
        selectedCountEl.textContent = `${count} đã chọn`;
    }
    
    // Show/hide bulk actions
    if (bulkActionsEl) {
        if (count > 0) {
            bulkActionsEl.classList.remove('hidden');
        } else {
            bulkActionsEl.classList.add('hidden');
        }
    }
    
    // Update select all checkbox state
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = count === totalCheckboxes && count > 0;
        selectAllCheckbox.indeterminate = count > 0 && count < totalCheckboxes;
    }
}

// ============================================
// EXPORT ACTIONS
// ============================================

/**
 * Download export and update order statuses
 */
async function downloadAndUpdateExport(exportId) {
    try {
        showToast('Đang tải file...', 'info');
        
        // Download file
        const downloadUrl = `${CONFIG.API_URL}?action=downloadExport&id=${exportId}`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Mark as downloaded and update order statuses
        const response = await fetch(`${CONFIG.API_URL}?action=markExportDownloaded`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exportId: exportId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`✅ Đã tải file và cập nhật ${data.updatedCount} đơn sang "Đã gửi hàng"`, 'success');
            
            // Invalidate cache and update badge
            exportHistoryCache = null;
            await updateExportHistoryBadge();
            
            // Reload orders and close modal
            await loadOrdersData();
            closeExportHistoryModal();
        } else {
            throw new Error(data.error || 'Không thể cập nhật trạng thái');
        }
        
    } catch (error) {
        console.error('Error downloading export:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

/**
 * Delete export file (Optimistic UI)
 */
async function deleteExportFile(exportId) {
    if (!confirm('Bạn có chắc chắn muốn xóa file export này?')) {
        return;
    }
    
    const itemElement = document.querySelector(`[data-export-item-id="${exportId}"]`);
    if (!itemElement) return;
    
    // Store original state for rollback
    const wasSelected = selectedExportIds.has(exportId);
    
    try {
        // Optimistic UI: Fade out
        itemElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        itemElement.style.opacity = '0';
        itemElement.style.transform = 'translateX(-20px)';
        
        // Update selection
        selectedExportIds.delete(exportId);
        updateSelectionUI();
        
        // Remove from DOM after animation
        setTimeout(() => {
            itemElement.remove();
            handleEmptyState();
        }, 300);
        
        // Delete from server
        const response = await fetch(`${CONFIG.API_URL}?action=deleteExport`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exportId })
        });
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Không thể xóa file');
        
        showToast('Đã xóa file export', 'success');
        exportHistoryCache = null;
        await updateExportHistoryBadge();
        
    } catch (error) {
        console.error('Error deleting export:', error);
        showToast('Lỗi: ' + error.message, 'error');
        
        // Rollback
        if (itemElement.parentElement) {
            itemElement.style.opacity = '1';
            itemElement.style.transform = 'translateX(0)';
            if (wasSelected) selectedExportIds.add(exportId);
            updateSelectionUI();
        } else {
            // Already removed, reload modal
            closeExportHistoryModal();
            setTimeout(() => showExportHistoryModal(), 300);
        }
    }
}

// ============================================
// BULK ACTIONS
// ============================================

/**
 * Bulk merge and download selected exports (Smart merge)
 */
async function bulkMergeAndDownloadExports() {
    console.log('🔵 [MERGE] Start - Selected IDs:', Array.from(selectedExportIds));
    
    if (selectedExportIds.size === 0) {
        showToast('Vui lòng chọn ít nhất 1 file để gộp', 'warning');
        return;
    }
    
    const count = selectedExportIds.size;
    console.log('🔵 [MERGE] Count:', count);
    
    // If only 1 file selected, just download it
    if (count === 1) {
        console.log('🔵 [MERGE] Only 1 file, calling downloadAndUpdateExport');
        const exportId = Array.from(selectedExportIds)[0];
        await downloadAndUpdateExport(exportId);
        console.log('🔵 [MERGE] downloadAndUpdateExport completed');
        return;
    }
    
    if (!confirm(`Bạn có muốn gộp ${count} file thành 1 file Excel duy nhất?`)) {
        console.log('🔵 [MERGE] User cancelled');
        return;
    }
    
    try {
        console.log('🔵 [MERGE] Starting merge process...');
        
        // Check if XLSX library is loaded
        if (typeof XLSX === 'undefined') {
            console.log('🔵 [MERGE] Loading XLSX library...');
            showToast('Đang tải thư viện Excel...', 'info');
            await loadXLSXLibrary();
            console.log('🔵 [MERGE] XLSX library loaded');
        } else {
            console.log('🔵 [MERGE] XLSX library already loaded');
        }
        
        showToast(`Đang gộp ${count} file...`, 'info');
        
        // Call backend to merge exports
        console.log('🔵 [MERGE] Calling API mergeExports...');
        const response = await fetch(`${CONFIG.API_URL}?action=mergeExports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exportIds: Array.from(selectedExportIds) })
        });
        console.log('🔵 [MERGE] API response received');
        
        const data = await response.json();
        console.log('🔵 [MERGE] API data parsed:', { success: data.success, totalOrders: data.totalOrders, exportCount: data.exportCount });
        
        if (!data.success) {
            throw new Error(data.error || 'Không thể gộp file');
        }
        
        showToast(`Đã gộp ${data.exportCount} file (${data.totalOrders} đơn hàng), đang tạo Excel...`, 'info');
        
        // Create merged Excel file on client
        console.log('🔵 [MERGE] Creating Excel workbook...');
        const { wb, filename } = createSPXExcelWorkbook(data.orders);
        console.log('🔵 [MERGE] Workbook created:', filename);
        
        // Save exportIds BEFORE closing modal (to avoid race condition)
        const exportIdsArray = Array.from(selectedExportIds);
        console.log('🔵 [MERGE] Saved export IDs:', exportIdsArray);
        
        // Close modal BEFORE downloading file
        console.log('🔵 [MERGE] Closing modal before download...');
        closeExportHistoryModal();
        console.log('🔵 [MERGE] Modal closed');
        
        // Download file using requestAnimationFrame to avoid blocking
        console.log('🔵 [MERGE] Scheduling file download...');
        requestAnimationFrame(() => {
            console.log('🔵 [MERGE] Writing file...');
            XLSX.writeFile(wb, filename);
            console.log('🔵 [MERGE] File written successfully');
            
            // Mark exports as downloaded in background (after download completes)
            setTimeout(() => {
                console.log('🔵 [MERGE] Marking exports as downloaded...');
                exportIdsArray.forEach(exportId => {
                    fetch(`${CONFIG.API_URL}?action=markExportDownloaded`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ exportId })
                    }).catch(err => console.error(`❌ [MERGE] Error marking export ${exportId}:`, err));
                });
                console.log('🔵 [MERGE] All mark requests sent');
            }, 1000);
            
            console.log('🔵 [MERGE] ✅ DONE');
        });
        
        console.log('🔵 [MERGE] ✅ Main process completed');
        
    } catch (error) {
        console.error('❌ [MERGE] Error merging exports:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

/**
 * Bulk download selected exports
 */
async function bulkDownloadExports() {
    if (selectedExportIds.size === 0) {
        showToast('Vui lòng chọn ít nhất 1 file để tải', 'warning');
        return;
    }
    
    const count = selectedExportIds.size;
    if (!confirm(`Bạn có chắc chắn muốn tải ${count} file đã chọn?`)) {
        return;
    }
    
    try {
        showToast(`Đang tải ${count} file...`, 'info');
        
        let successCount = 0;
        let errorCount = 0;
        
        // Download each file with delay to avoid overwhelming browser
        for (const exportId of selectedExportIds) {
            try {
                // Download file
                const downloadUrl = `${CONFIG.API_URL}?action=downloadExport&id=${exportId}`;
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = '';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Mark as downloaded
                await fetch(`${CONFIG.API_URL}?action=markExportDownloaded`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ exportId: exportId })
                });
                
                successCount++;
                
                // Small delay between downloads
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`Error downloading export ${exportId}:`, error);
                errorCount++;
            }
        }
        
        // Show result
        if (errorCount === 0) {
            showToast(`✅ Đã tải thành công ${successCount} file`, 'success');
        } else {
            showToast(`⚠️ Đã tải ${successCount} file, ${errorCount} file lỗi`, 'warning');
        }
        
        // Close modal immediately
        closeExportHistoryModal();
        
        // Refresh in background (non-blocking)
        exportHistoryCache = null;
        updateExportHistoryBadge();
        loadOrdersData().catch(err => console.error('Error reloading orders:', err));
        
    } catch (error) {
        console.error('Error bulk downloading:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

/**
 * Bulk delete selected exports (Optimistic UI)
 */
async function bulkDeleteExports() {
    if (selectedExportIds.size === 0) {
        showToast('Vui lòng chọn ít nhất 1 file để xóa', 'warning');
        return;
    }
    
    const count = selectedExportIds.size;
    if (!confirm(`Bạn có chắc chắn muốn xóa ${count} file đã chọn? Hành động này không thể hoàn tác.`)) {
        return;
    }
    
    try {
        showToast(`Đang xóa ${count} file...`, 'info');
        
        // Collect items using optimized selector
        const itemsToDelete = Array.from(selectedExportIds).map(exportId => {
            const element = document.querySelector(`[data-export-item-id="${exportId}"]`);
            return element ? { exportId, element } : null;
        }).filter(Boolean);
        
        // Optimistic UI: Fade out all
        itemsToDelete.forEach(({ element }) => {
            element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            element.style.opacity = '0';
            element.style.transform = 'translateX(-20px)';
        });
        
        selectedExportIds.clear();
        updateSelectionUI();
        
        // Remove from DOM after animation
        setTimeout(() => {
            itemsToDelete.forEach(({ element }) => element.remove());
            handleEmptyState();
        }, 300);
        
        // Delete from server
        let successCount = 0;
        let errorCount = 0;
        
        for (const { exportId } of itemsToDelete) {
            try {
                const response = await fetch(`${CONFIG.API_URL}?action=deleteExport`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ exportId })
                });
                
                const data = await response.json();
                data.success ? successCount++ : errorCount++;
                
            } catch (error) {
                console.error(`Error deleting export ${exportId}:`, error);
                errorCount++;
            }
        }
        
        // Show result
        showToast(
            errorCount === 0 
                ? `✅ Đã xóa thành công ${successCount} file` 
                : `⚠️ Đã xóa ${successCount} file, ${errorCount} file lỗi`,
            errorCount === 0 ? 'success' : 'warning'
        );
        
        exportHistoryCache = null;
        await updateExportHistoryBadge();
        
    } catch (error) {
        console.error('Error bulk deleting:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}
