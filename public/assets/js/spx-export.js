// SPX Export Module - Export orders to SPX Excel format

/**
 * Parse address into components (Tỉnh/Quận/Xã/Địa chỉ chi tiết)
 * Format: "Địa chỉ chi tiết, Xã/Phường, Quận/Huyện, Tỉnh/TP"
 */
function parseAddress(address) {
    if (!address) {
        return {
            province: '',
            district: '',
            ward: '',
            detail: ''
        };
    }

    // Split by comma
    const parts = address.split(',').map(p => p.trim());
    
    if (parts.length >= 4) {
        // Full format: detail, ward, district, province
        return {
            province: parts[parts.length - 1],
            district: parts[parts.length - 2],
            ward: parts[parts.length - 3],
            detail: parts.slice(0, parts.length - 3).join(', ')
        };
    } else if (parts.length === 3) {
        // Missing ward: detail, district, province
        return {
            province: parts[2],
            district: parts[1],
            ward: '',
            detail: parts[0]
        };
    } else if (parts.length === 2) {
        // Only district and province: detail, province
        return {
            province: parts[1],
            district: '',
            ward: '',
            detail: parts[0]
        };
    } else {
        // Only one part - treat as detail
        return {
            province: '',
            district: '',
            ward: '',
            detail: address
        };
    }
}

/**
 * Format product name with size/weight
 * Logic: Only "cm" suffix = size tay, everything else = cân nặng (kg)
 */
function formatProductName(name, size) {
    if (!size) return name;
    
    const sizeStr = size.toString().toLowerCase().trim();
    
    // Check if size contains 'cm' - for bracelet size
    if (sizeStr.includes('cm')) {
        // Extract number: "14cm" or "14" -> "14"
        const cmValue = sizeStr.replace(/[^0-9.]/g, '');
        return `${name} cho size tay ${cmValue}cm`;
    }
    
    // Everything else is weight (kg) - including numbers without suffix
    // Extract number and format as kg
    const kgValue = sizeStr.replace(/[^0-9.]/g, '');
    if (kgValue) {
        return `${name} cho bé ${kgValue}kg`;
    }
    
    // If no number found, return as is
    return name;
}

/**
 * Parse products JSON to product list
 */
function parseProducts(productsJson) {
    if (!productsJson) return [];
    
    try {
        const products = typeof productsJson === 'string' ? JSON.parse(productsJson) : productsJson;
        if (Array.isArray(products)) {
            return products.map(p => ({
                name: formatProductName(p.name || p.product_name || '', p.size || p.weight || ''),
                quantity: p.quantity || 1,
                price: p.price || p.unit_price || 0,
                notes: p.notes || null
            }));
        }
    } catch (e) {
        console.warn('Could not parse products:', e);
    }
    
    return [];
}

/**
 * Convert Uint8Array to base64 in chunks to avoid blocking UI
 */
function arrayBufferToBase64Chunked(buffer) {
    return new Promise((resolve) => {
        const uint8Array = new Uint8Array(buffer);
        const chunkSize = 8192; // Process 8KB at a time
        let binary = '';
        let offset = 0;
        
        function processChunk() {
            const end = Math.min(offset + chunkSize, uint8Array.length);
            
            // Process chunk
            for (let i = offset; i < end; i++) {
                binary += String.fromCharCode(uint8Array[i]);
            }
            
            offset = end;
            
            // If more chunks remain, schedule next chunk
            if (offset < uint8Array.length) {
                setTimeout(processChunk, 0); // Let UI breathe
            } else {
                // All done, convert to base64
                resolve(btoa(binary));
            }
        }
        
        processChunk();
    });
}

/**
 * Export selected orders to SPX Excel format and save to R2
 */
async function exportToSPXExcelAndSave(orders) {
    if (!orders || orders.length === 0) {
        throw new Error('Không có đơn hàng nào để export');
    }

    // Create Excel file
    const { wb, filename, orderIds } = createSPXExcelWorkbook(orders);
    
    // Convert workbook to binary
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    
    // Convert to base64 in chunks (non-blocking)
    const base64 = await arrayBufferToBase64Chunked(wbout);
    
    // Save to R2 via API
    const response = await fetch(`${CONFIG.API_URL}?action=saveExport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fileName: filename,
            fileData: base64,
            orderIds: orderIds,
            orderCount: orders.length
        })
    });
    
    const data = await response.json();
    
    if (!data.success) {
        throw new Error(data.error || 'Không thể lưu file export');
    }
    
    return {
        success: true,
        exportId: data.exportId,
        filename: filename,
        count: orders.length
    };
}

/**
 * Create SPX Excel workbook (shared logic)
 */
function createSPXExcelWorkbook(orders) {
    // Prepare data rows
    const rows = [];
    const orderIds = [];
    
    orders.forEach(order => {
        orderIds.push(order.id);
        
        const address = parseAddress(order.address);
        const products = parseProducts(order.products);
        
        // Format all products into one line (like Copy SPX Format)
        let productText = '';
        if (products.length > 0) {
            const productLines = products.map(product => {
                let line = product.name;
                line += ` - Số lượng: ${product.quantity}`;
                if (product.notes) {
                    line += ` - Lưu ý: ${product.notes}`;
                }
                return `[${line}]`;
            });
            productText = productLines.join(' ----- ');
            
            // Add order notes if exists
            if (order.notes && order.notes.trim()) {
                productText += ` ----- Lưu ý tổng: ${order.notes.trim()}`;
            }
        }
        
        // Create single row per order
        const row = {
            '*Mã đơn hàng': order.order_id || '',
            '*Tên người nhận': order.customer_name || '',
            '*Số điện thoại': order.customer_phone || '',
            '*Tỉnh/Thành Phố': address.province,
            '*Quận/Huyện': address.district,
            '*Xã/Phường': address.ward,
            '*Địa chỉ chi tiết': address.detail,
            'Lưu ý về địa chỉ': '',
            'Mã bưu chính': '',
            '*Tên sản phẩm': productText,
            'Số lượng (Thông tin bắt buộc khi chọn Giao hàng một phần & Thu COD)': '',
            'Giá tiền (Thông tin bắt buộc khi chọn Giao hàng một phần & Thu COD)': '',
            '*Tổng cân nặng bưu gửi (KG)': 0.5,
            'Chiều dài (CM)': 15,
            'Chiều rộng (CM)': 10,
            'Chiều cao (CM)': 5,
            'Mã khách hàng': '',
            '*Giá trị đơn hàng': order.total_amount || 0,
            '*Giao hàng một phần (Y/N)': 'N',
            '*Cho phép thử hàng (Y/N)': 'Y',
            '*Cho xem hàng, không cho thử (Y/N)': 'Y',
            'Thu phí từ chối nhận hàng (Y/N)': '',
            'Phí từ chối nhận hàng cần thu': '',
            '*Thu COD (Y/N)': 'Y',
            'Số tiền COD': order.total_amount || 0,
            'bưu gửi giá trị cao (Y/N)': '',
            '*Hình thức thanh Toán': 'Người gửi trả',
            'Lưu ý giao hàng': '',
            'Nhắc nhở điền đúng số tiền COD': '',
            'Đơn chỉ hoàn thành nếu ở dưới hiện "Đủ điều kiện"': ''
        };
        rows.push(row);
    });

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Create worksheet from data
    const ws = XLSX.utils.json_to_sheet(rows);
    
    // Set column widths for better readability
    const colWidths = [
        { wch: 15 },  // Mã đơn hàng
        { wch: 20 },  // Tên người nhận
        { wch: 12 },  // SĐT
        { wch: 18 },  // Tỉnh/TP
        { wch: 18 },  // Quận/Huyện
        { wch: 18 },  // Xã/Phường
        { wch: 30 },  // Địa chỉ chi tiết
        { wch: 15 },  // Lưu ý địa chỉ
        { wch: 12 },  // Mã bưu chính
        { wch: 25 },  // Tên sản phẩm
        { wch: 10 },  // Số lượng
        { wch: 12 },  // Giá tiền
        { wch: 12 },  // Cân nặng
        { wch: 10 },  // Dài
        { wch: 10 },  // Rộng
        { wch: 10 },  // Cao
        { wch: 12 },  // Mã KH
        { wch: 12 },  // Giá trị đơn
        { wch: 12 },  // Giao 1 phần
        { wch: 12 },  // Thử hàng
        { wch: 12 },  // Xem hàng
        { wch: 12 },  // Phí từ chối
        { wch: 12 },  // Số tiền phí
        { wch: 10 },  // Thu COD
        { wch: 12 },  // Số tiền COD
        { wch: 12 },  // Giá trị cao
        { wch: 15 },  // Hình thức TT
        { wch: 20 },  // Lưu ý giao
        { wch: 15 },  // Nhắc nhở
        { wch: 15 }   // Đủ điều kiện
    ];
    ws['!cols'] = colWidths;
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Tạo đơn');
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `SPX_DonHang_${timestamp}_${orders.length}don.xlsx`;
    
    return { wb, filename, orderIds };
}

/**
 * Export selected orders to SPX Excel format (legacy - download immediately)
 */
async function exportToSPXExcel(orders) {
    const { wb, filename } = createSPXExcelWorkbook(orders);
    
    // Write file in next tick to avoid blocking UI
    await new Promise(resolve => {
        setTimeout(() => {
            XLSX.writeFile(wb, filename);
            resolve();
        }, 0);
    });
    
    return {
        success: true,
        filename: filename,
        count: orders.length,
        rows: orders.length
    };
}
