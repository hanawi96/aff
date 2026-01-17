// Export History Service

// Get export history
export async function getExportHistory(env) {
    const { results: exports } = await env.DB.prepare(`
        SELECT 
            id,
            created_at,
            order_count,
            order_ids,
            file_name,
            status,
            downloaded_at
        FROM export_history
        ORDER BY created_at DESC
        LIMIT 50
    `).all();

    return {
        success: true,
        exports: exports
    };
}

// Save export to R2 and database
export async function saveExport(data, env) {
    const { fileName, fileData, orderIds, orderCount } = data;

    if (!fileName || !fileData || !orderIds) {
        throw new Error('Missing required fields');
    }

    // Decode base64 file data
    const fileBuffer = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));
    
    // Generate file path
    const timestamp = Date.now();
    const filePath = `exports/${timestamp}_${fileName}`;

    // Upload to R2
    await env.R2_EXCEL_BUCKET.put(filePath, fileBuffer, {
        httpMetadata: {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
    });

    // Save to database
    const result = await env.DB.prepare(`
        INSERT INTO export_history (created_at, order_count, order_ids, file_name, file_path, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
    `).bind(
        timestamp,
        orderCount,
        JSON.stringify(orderIds),
        fileName,
        filePath
    ).run();

    if (!result.success) {
        throw new Error(result.error || 'Failed to save to database');
    }

    // Convert BigInt to Number (Turso returns BigInt)
    const exportId = typeof result.meta?.last_row_id === 'bigint' 
        ? Number(result.meta.last_row_id) 
        : (result.meta?.last_row_id || timestamp);

    return {
        success: true,
        exportId,
        fileName
    };
}

// Download export file
export async function downloadExport(exportId, env) {
    if (!exportId) {
        throw new Error('Export ID is required');
    }

    // Get export info from database
    const exportInfo = await env.DB.prepare(`
        SELECT file_path, file_name, order_ids, status
        FROM export_history
        WHERE id = ?
    `).bind(exportId).first();

    if (!exportInfo) {
        throw new Error('Export not found');
    }

    // Get file from R2
    const object = await env.R2_EXCEL_BUCKET.get(exportInfo.file_path);
    
    if (!object) {
        throw new Error('File not found in storage');
    }

    return {
        file: object.body,
        fileName: exportInfo.file_name,
        orderIds: JSON.parse(exportInfo.order_ids)
    };
}

// Mark export as downloaded and update order statuses
export async function markExportDownloaded(exportId, env) {
    if (!exportId) {
        throw new Error('Export ID is required');
    }

    // Get export info
    const exportInfo = await env.DB.prepare(`
        SELECT order_ids, status
        FROM export_history
        WHERE id = ?
    `).bind(exportId).first();

    if (!exportInfo) {
        throw new Error('Export not found');
    }

    // Update export status
    const now = Date.now();
    await env.DB.prepare(`
        UPDATE export_history
        SET status = 'downloaded', downloaded_at = ?, updated_at = ?
        WHERE id = ?
    `).bind(now, now, exportId).run();

    // Update order statuses to "shipped" and remove priority flag
    const orderIds = JSON.parse(exportInfo.order_ids);
    let updatedCount = 0;

    for (const orderId of orderIds) {
        try {
            // Check current status
            const order = await env.DB.prepare(`
                SELECT status FROM orders WHERE id = ?
            `).bind(orderId).first();

            if (order && order.status !== 'shipped' && order.status !== 'in_transit' && 
                order.status !== 'delivered' && order.status !== 'failed') {
                
                // Update status to "shipped" AND remove priority flag
                await env.DB.prepare(`
                    UPDATE orders 
                    SET status = 'shipped', is_priority = 0 
                    WHERE id = ?
                `).bind(orderId).run();
                
                updatedCount++;
            } else if (order) {
                // Order already shipped/delivered, just remove priority flag
                await env.DB.prepare(`
                    UPDATE orders 
                    SET is_priority = 0 
                    WHERE id = ?
                `).bind(orderId).run();
            }
        } catch (err) {
            console.error(`Error updating order ${orderId}:`, err);
        }
    }

    return {
        success: true,
        updatedCount: updatedCount
    };
}

// Delete export
export async function deleteExport(exportId, env) {
    if (!exportId) {
        throw new Error('Export ID is required');
    }

    // Get file path
    const exportInfo = await env.DB.prepare(`
        SELECT file_path FROM export_history WHERE id = ?
    `).bind(exportId).first();

    if (!exportInfo) {
        throw new Error('Export not found');
    }

    // Delete from R2
    await env.R2_EXCEL_BUCKET.delete(exportInfo.file_path);

    // Delete from database
    await env.DB.prepare(`
        DELETE FROM export_history WHERE id = ?
    `).bind(exportId).run();

    return {
        success: true,
        message: 'Export deleted successfully'
    };
}

// Merge multiple exports into one
export async function mergeExports(exportIds, env) {
    if (!exportIds || !Array.isArray(exportIds) || exportIds.length === 0) {
        throw new Error('Export IDs array is required');
    }

    // Get all export info
    const placeholders = exportIds.map(() => '?').join(',');
    const { results: exports } = await env.DB.prepare(`
        SELECT id, order_ids, file_name
        FROM export_history
        WHERE id IN (${placeholders})
    `).bind(...exportIds).all();

    if (!exports || exports.length === 0) {
        throw new Error('No exports found');
    }

    // Collect all unique order IDs
    const allOrderIds = new Set();
    exports.forEach(exp => {
        const orderIds = JSON.parse(exp.order_ids);
        orderIds.forEach(id => allOrderIds.add(id));
    });

    // Fetch all orders
    const orderIdsArray = Array.from(allOrderIds);
    const orderPlaceholders = orderIdsArray.map(() => '?').join(',');
    const { results: orders } = await env.DB.prepare(`
        SELECT 
            id, order_id, customer_name, customer_phone, address,
            products, notes, total_amount, payment_method
        FROM orders
        WHERE id IN (${orderPlaceholders})
        ORDER BY created_at DESC
    `).bind(...orderIdsArray).all();

    if (!orders || orders.length === 0) {
        throw new Error('No orders found');
    }

    return {
        success: true,
        orders: orders,
        totalOrders: orders.length,
        exportCount: exports.length
    };
}
