// SPX Export Module - Export orders to SPX Excel format

/**
 * Parse address into components for SPX export (Tỉnh/Quận/Xã/Địa chỉ chi tiết)
 * PRIORITY 1: Look up name_with_type from addressSelector using stored IDs (most accurate)
 * PRIORITY 2: Use stored structured name fields (may have short names without type prefix)
 * PRIORITY 3: Parse old address string (backward compatibility)
 */
function parseAddressForExport(order) {
    // PRIORITY 1: Use IDs to look up full names from tree_2.json (2 cấp)
    if (order.province_id && window.addressSelector?.loaded) {
        const pId = String(order.province_id);
        const wId = order.ward_id ? String(order.ward_id) : '';
        const pName = window.addressSelector.getProvinceName(pId);
        const wName = wId ? window.addressSelector.getWardName(pId, wId) : '';
        if (pName) {
            return {
                province: pName || order.province_name || '',
                district: order.district_name || '',
                ward: wName || order.ward_name || '',
                detail: order.street_address || ''
            };
        }
    }

    // PRIORITY 2: Use stored structured address fields
    if (order.province_name || order.ward_name || order.street_address) {
        return {
            province: order.province_name || '',
            district: order.district_name || '',
            ward: order.ward_name || '',
            detail: order.street_address || ''
        };
    }
    
    // PRIORITY 2: Parse old address field (backward compatibility)
    const address = order.address;
    
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
 * SPX Excel: cột Tỉnh/TP chỉ cần tên địa danh, không kèm "Tỉnh " / "Thành phố ".
 */
function stripProvinceAdministrativePrefix(name) {
    if (!name || typeof name !== 'string') return '';
    return name.trim().replace(/^(?:Thành [Pp]hố|Tỉnh)\s+/u, '');
}

/**
 * Parse products JSON to product list（商品名保持原名，与 Copy SPX 共用 formatSPXProductBracketLine）
 */
function parseProducts(productsJson) {
    if (!productsJson) return [];
    
    try {
        const products = typeof productsJson === 'string' ? JSON.parse(productsJson) : productsJson;
        if (Array.isArray(products)) {
            return products.map(p => ({
                name: p.name || p.product_name || '',
                sizeOrWeight: p.size || p.weight || null,
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
        
        // IMPROVED: Pass entire order object to parseAddressForExport
        const address = parseAddressForExport(order);
        const products = parseProducts(order.products);
        
        const orderDeliveryNote =
            order.notes && String(order.notes).trim() ? String(order.notes).trim() : '';
        const productBracketLines = products.map(product =>
            formatSPXProductBracketLine(
                product.name,
                product.sizeOrWeight,
                product.quantity,
                product.notes
            )
        );
        const productText = buildSPXProductColumnText(productBracketLines, orderDeliveryNote);
        
        // COD: thu khi giao = total − cọc (CK → 0). Giá trị đơn hàng = full total_amount.
        const isBankTransfer = isOrderBankPayment(order.payment_method);
        const orderValue = order.total_amount || 0;
        const codAmount = getOrderCodCollectAmount(order);
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
            '*Giá trị đơn hàng': orderValue,
            '*Giao hàng một phần (Y/N)': 'N',
            '*Cho phép thử hàng (Y/N)': 'Y',
            '*Cho xem hàng, không cho thử (Y/N)': 'Y',
            'Thu phí từ chối nhận hàng (Y/N)': '',
            'Phí từ chối nhận hàng cần thu': '',
            '*Thu COD (Y/N)': collectCOD,
            'Số tiền COD': codAmount,
            'bưu gửi giá trị cao (Y/N)': '',
            '*Hình thức thanh Toán': 'Người gửi trả',
            'Lưu ý giao hàng': orderDeliveryNote,
            'Nhắc nhở điền đúng số tiền COD': '',
            'Đơn chỉ hoàn thành nếu ở dưới hiện "Đủ điều kiện"': ''
        };
        rows.push(row);
    });

    const is2Level = !orders.some(o => o.district_name || o.district_id);

    if (is2Level) {
        rows.forEach(row => { delete row['*Quận/Huyện']; });
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    if (is2Level) {
        const colWidths = [
            { wch: 15 },  // Mã đơn hàng
            { wch: 20 },  // Tên người nhận
            { wch: 12 },  // SĐT
            { wch: 22 },  // Tỉnh/TP
            { wch: 22 },  // Xã/Phường
            { wch: 30 },  // Địa chỉ chi tiết
            { wch: 15 },  // Lưu ý địa chỉ
            { wch: 12 },  // Mã bưu chính
            { wch: 25 },  // Tên sản phẩm
            { wch: 10 }, { wch: 12 }, { wch: 12 },
            { wch: 10 }, { wch: 10 }, { wch: 10 },
            { wch: 12 }, { wch: 12 }, { wch: 12 },
            { wch: 12 }, { wch: 12 }, { wch: 12 },
            { wch: 12 }, { wch: 10 }, { wch: 12 },
            { wch: 12 }, { wch: 15 }, { wch: 20 },
            { wch: 15 }, { wch: 15 }
        ];
        ws['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(wb, ws, 'Tạo đơn (địa chỉ mới)');

        _appendAddressValidationSheets2Level(wb);
    } else {
        const colWidths = [
            { wch: 15 }, { wch: 20 }, { wch: 12 },
            { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 30 },
            { wch: 15 }, { wch: 12 }, { wch: 25 },
            { wch: 10 }, { wch: 12 }, { wch: 12 },
            { wch: 10 }, { wch: 10 }, { wch: 10 },
            { wch: 12 }, { wch: 12 }, { wch: 12 },
            { wch: 12 }, { wch: 12 }, { wch: 12 },
            { wch: 12 }, { wch: 10 }, { wch: 12 },
            { wch: 12 }, { wch: 15 }, { wch: 20 },
            { wch: 15 }, { wch: 15 }
        ];
        ws['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(wb, ws, 'Tạo đơn');
    }

    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `SPX_DonHang_${timestamp}_${orders.length}don.xlsx`;

    return { wb, filename, orderIds };
}

function _appendAddressValidationSheets2Level(wb) {
    if (!window.addressSelector?.loaded) return;

    const stateRows = [];
    const cityRows = [];

    window.addressSelector.data.forEach(province => {
        const pName = province.Name || '';
        stateRows.push({ State: pName });

        province.Wards.forEach(ward => {
            cityRows.push({ State: pName, City: ward.Name || '' });
        });
    });

    const wsState = XLSX.utils.json_to_sheet(stateRows);
    wsState['!cols'] = [{ wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsState, 'State_list(2)');

    const wsCity = XLSX.utils.json_to_sheet(cityRows);
    wsCity['!cols'] = [{ wch: 25 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsCity, 'City_list(2)');
}
