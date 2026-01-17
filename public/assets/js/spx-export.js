// SPX Export Module - Export orders to SPX Excel format

/**
 * Parse address into components for SPX export (Tỉnh/Quận/Xã/Địa chỉ chi tiết)
 * IMPROVED: Prioritize structured address fields (province_name, district_name, etc.)
 * Fallback to parsing old address field if structured fields not available
 */
function parseAddressForExport(order) {
    console.log('🔍 [parseAddressForExport] Input order:', {
        id: order.id,
        order_id: order.order_id,
        address: order.address,
        province_name: order.province_name,
        district_name: order.district_name,
        ward_name: order.ward_name,
        street_address: order.street_address
    });
    
    // PRIORITY 1: Use structured address fields (new format)
    if (order.province_name || order.district_name || order.ward_name || order.street_address) {
        const result = {
            province: order.province_name || '',
            district: order.district_name || '',
            ward: order.ward_name || '',
            detail: order.street_address || ''
        };
        console.log('✅ [parseAddressForExport] Using structured fields:', result);
        return result;
    }
    
    // PRIORITY 2: Parse old address field (backward compatibility)
    const address = order.address;
    
    if (!address) {
        console.warn('⚠️ [parseAddressForExport] No address data found for order:', order.order_id);
        return {
            province: '',
            district: '',
            ward: '',
            detail: ''
        };
    }

    console.log('📝 [parseAddressForExport] Parsing old address field:', address);

    // Split by comma
    const parts = address.split(',').map(p => p.trim());
    console.log('📝 [parseAddressForExport] Split into', parts.length, 'parts:', parts);
    
    let result;
    
    if (parts.length >= 4) {
        // Full format: detail, ward, district, province
        result = {
            province: parts[parts.length - 1],
            district: parts[parts.length - 2],
            ward: parts[parts.length - 3],
            detail: parts.slice(0, parts.length - 3).join(', ')
        };
    } else if (parts.length === 3) {
        // Missing ward: detail, district, province
        result = {
            province: parts[2],
            district: parts[1],
            ward: '',
            detail: parts[0]
        };
    } else if (parts.length === 2) {
        // Only district and province: detail, province
        result = {
            province: parts[1],
            district: '',
            ward: '',
            detail: parts[0]
        };
    } else {
        // Only one part - treat as detail
        result = {
            province: '',
            district: '',
            ward: '',
            detail: address
        };
    }
    
    console.log('✅ [parseAddressForExport] Parsed result:', result);
    return result;
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
    console.log('🚀 [exportToSPXExcelAndSave] Starting export for', orders.length, 'orders');
    console.log('📦 [exportToSPXExcelAndSave] First order sample:', orders[0]);
    
    if (!orders || orders.length === 0) {
        throw new Error('Không có đơn hàng nào để export');
    }

    // Create Excel file
    const { wb, filename, orderIds } = createSPXExcelWorkbook(orders);
    
    console.log('📊 [exportToSPXExcelAndSave] Workbook created, converting to binary...');
    
    // Convert workbook to binary
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    
    console.log('📊 [exportToSPXExcelAndSave] Binary size:', wbout.byteLength, 'bytes');
    
    // Convert to base64 in chunks (non-blocking)
    const base64 = await arrayBufferToBase64Chunked(wbout);
    
    console.log('📊 [exportToSPXExcelAndSave] Base64 size:', base64.length, 'chars');
    console.log('💾 [exportToSPXExcelAndSave] Saving to R2...');
    
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
    console.log('📊 [createSPXExcelWorkbook] Creating workbook for', orders.length, 'orders');
    
    // Prepare data rows
    const rows = [];
    const orderIds = [];
    
    orders.forEach((order, index) => {
        console.log(`\n📦 [Order ${index + 1}/${orders.length}] Processing order:`, order.order_id);
        
        orderIds.push(order.id);
        
        // IMPROVED: Pass entire order object to parseAddressForExport
        const address = parseAddressForExport(order);
        const products = parseProducts(order.products);
        
        console.log('📍 [Order] Address parsed:', address);
        console.log('📦 [Order] Products:', products.length, 'items');
        
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
        
        // Determine COD amount based on payment method
        // - If bank transfer: COD = 0 (already paid)
        // - If COD: COD = total_amount (collect on delivery)
        const paymentMethod = order.payment_method || 'cod';
        const isBankTransfer = paymentMethod === 'bank';
        const codAmount = isBankTransfer ? 0 : (order.total_amount || 0);
        const collectCOD = isBankTransfer ? 'N' : 'Y';
        
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
            '*Thu COD (Y/N)': collectCOD,
            'Số tiền COD': codAmount,
            'bưu gửi giá trị cao (Y/N)': '',
            '*Hình thức thanh Toán': 'Người gửi trả',
            'Lưu ý giao hàng': '',
            'Nhắc nhở điền đúng số tiền COD': '',
            'Đơn chỉ hoàn thành nếu ở dưới hiện "Đủ điều kiện"': ''
        };
        
        console.log('📋 [Order] Excel row created:', {
            order_id: row['*Mã đơn hàng'],
            province: row['*Tỉnh/Thành Phố'],
            district: row['*Quận/Huyện'],
            ward: row['*Xã/Phường'],
            detail: row['*Địa chỉ chi tiết']
        });
        
        rows.push(row);
    });
    
    console.log('✅ [createSPXExcelWorkbook] Created', rows.length, 'rows');
    console.log('📊 [createSPXExcelWorkbook] Sample row 1:', rows[0]);

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
