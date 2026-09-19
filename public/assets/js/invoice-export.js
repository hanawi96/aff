// =============================================================================
// INVOICE EXPORT MODULE - MauUploadHD.xlsx (Hóa Đơn Điện Tử Hàng Loạt)
// =============================================================================

const INVOICE_EXCEL_HEADERS = [
    'MaHD', 'FKEY', 'NgayHoaDon', 'MaKhachHang', 'TenNguoiMua', 'TenDonVi',
    'DiaChiKhachHang', 'MaSoThue', 'CCCD', 'SoHoChieu', 'MaNganSach',
    'LoaiDacTrung', 'HoaDonChietKhau', 'ThueSuat', 'TienThue', 'TGTKhac',
    'TyGia', 'LoaiTien', 'TienBangChu', 'TinhChatHanghoa', 'MaHangHoa',
    'TenHangHoa', 'GhiChu', 'DonViTinh', 'SoLuong', 'DonGia', 'ThanhTien',
    'TienChietKhau', 'ChietKhau', 'EmailKhachHang', 'MailCC', 'PhuongThucTT',
    'SoTaiKhoan', 'TenNganHang', 'PExtra01', 'PExtra02', 'PExtra03',
    'PExtra04', 'PExtra05', 'PExtra06', 'PExtra07', 'PExtra08', 'PExtra09',
    'PExtra10', 'Extra01', 'Extra02', 'Extra03', 'Extra04', 'Extra05',
    'Extra06', 'Extra07', 'Extra08', 'Extra09', 'Extra10', 'Extra11', 'Extra12'
];

const INVOICE_DESCRIPTION_ROWS = [
    ['Tên cột', 'Tên cột', 'Kiểu dữ liệu', 'Độ dài', 'Bắt buộc', 'Ràng buộc', 'Lưu ý'],
    ['MaHD', 'Mã HD', 'Số', null, 'Có', '- Nhập Mã hóa đơn của lô hóa đơn cần upload của đơn vị'],
    ['NgayHoaDon', 'Ngày HD', 'Ngày/ tháng/ năm', null, 'Có', '- Nhập ngày hóa đơn', 'Format: dd/mm/yyyy\nVí dụ: 29/12/2019'],
    ['MaKhachHang', 'Mã khách hàng', 'Text', 50, 'Không', '- Nhập mã khách hàng'],
    ['TenNguoiMua', 'Tên người mua', 'Text', 200, 'Không', '- Nhập tên người mua hàng'],
    ['TenDonVi', 'Tên đơn vị', 'Text', 50, 'Có', '- Nhập tên đơn vị'],
    ['DiaChiKhachHang', 'Địa chỉ khách hàng', 'Text', 300, 'Không', '- Nhập địa chỉ khách hàng'],
    ['MaSoThue', 'Mã số thuế', 'Text', 20, 'Không', '- Nhập mã số thuế khách hàng'],
    ['CCCD', 'Căn cước/Số định danh', 'Text', 12, 'Không', '- Nhập căn cước/Số định danh khách hàng'],
    ['Sohochieu', 'Số hộ chiếu', 'Text', 20, 'Không', '- Nhập số hộ chiếu khách hàng'],
    ['Mangansach', 'Mã quan hệ ngân sách', 'Text', 7, 'Không', '- Nhập mã quan hệ ngân sách'],
    ['LoaiDacTrung', 'Mã nhóm hàng hóa đặc trưng', 'Text', 1, 'Không', 'Nhập mã hàng hóa đặc trưng', '1 - Hàng hóa là xe ô tô, xe mô tô\nYêu cầu phải nhập : PExtra01 (Số khung), PExtra02 (Số máy)\n2 - Dịch vụ vận chuyển\nYêu cầu phải nhập PExtra01 (Biển kiểm soát)\n3 - Dịch vụ vận chuyển trên nền tảng số, TMĐT\nYêu cầu phải nhập : PExtra01, PExtra02, PExtra03, PExtra04'],
    ['HoaDonChietKhau', 'Loại hóa dơn chiết khấu', 'Text', 1, 'Không', 'Nhập loại hóa đơn chiết khấu nếu sử dụng', '1 - Hóa đơn chiết khấu\n0 hoặc không truyền nếu là hóa đơn thông thường'],
    ['ThueSuat', 'Thuế suất', 'Số', null, 'Không', 'Nhập thuế suất:\n0: Tương ứng với giá trị 0%\n5: Tương ứng với giá trị 5%\n10: Tương ứng với giá trị 10%\n-1: Tương ứng với giá trị Không thuế GTGT', '0: Tương ứng với giá trị 0%\n5: Tương ứng với giá trị 5%\n10: Tương ứng với giá trị 10%\n-1: Tương ứng với giá trị Không thuế GTGT'],
    ['TienThue', 'Tiền thuế', 'Số', null, 'Không', '- Nhập tiền thuế\n- Cho phép nhập số tiền >= 0', 'Không nhập số âm\nLưu ý: \nLoại tiền là VND thì số tiền phải là số nguyên;\nLoại tiền là ngoại tệ thì số tiền có thể là số thập phân theo chuẩn quốc tế không format vidu: 1000.09 (Một nghìn phẩy không chín)'],
    ['TyGia', 'Tỷ giá', 'Số', null, 'Không', '- Nhập tỷ giá\n- Cho phép nhập số  >= 0', 'Không nhập số âm\nLưu ý: \nLoại tiền là VND thì số tiền phải là số nguyên;\nLoại tiền là ngoại tệ thì số tiền có thể là số thập phân theo chuẩn quốc tế không format vidu: 1000.09 (Một nghìn phẩy không chín)'],
    ['Loaitien', 'Loại tiền', 'Text', 3, 'có (nếu là ngoại tệ)'],
    ['TienBangChu', 'Tiền bằng chữ', 'Text', 255, 'Không', '- Nhập tiền bằng chữ'],
    ['MaHangHoa', 'Mã hàng hóa', 'Text', 20, 'Có', '- Nhập mã hàng hóa'],
    ['TenHangHoa', 'Tên hàng hóa', 'Text', 512, 'Có', '- Nhập tên hàng hóa'],
    ['GhiChu', 'Ghi chú', 'Text', 500, 'Không', '- Nhập ghi chú sản phẩm'],
    ['DonViTinh', 'Đơn vị tính', 'Text', 50, 'Không', '- Nhập đơn vị tính'],
    ['SoLuong', 'Số lượng', 'Số', null, 'Không', '- Nhập số lượng\n- Cho phép nhập số >= 0', 'Không nhập số âm\n'],
    ['DonGia', 'Đơn giá', 'Số', null, 'Không', '- Nhập đơn giá\n- Cho phép nhập số tiền >=0', 'Không nhập số âm\nLưu ý: \nLoại tiền là VND thì số tiền phải là số nguyên;\nLoại tiền là ngoại tệ thì số tiền có thể là số thập phân theo chuẩn quốc tế không format vidu: 1000.09 (Một nghìn phẩy không chín)'],
    ['ThanhTien', 'Thành tiền', 'Số', null, 'Không', '- Nhập thành tiền\n- Cho phép nhập số tiền >=0', 'Không nhập số âm\nLưu ý: \nLoại tiền là VND thì số tiền phải là số nguyên;\nLoại tiền là ngoại tệ thì số tiền có thể là số thập phân theo chuẩn quốc tế không format vidu: 1000.09 (Một nghìn phẩy không chín)'],
    ['TienChietKhau', 'Số tiền chiết khấu', 'Số', null, 'Không', '- Nhập thành tiền\n- Cho phép nhập số tiền >=0', 'Không nhập số âm\nLưu ý: \nLoại tiền là VND thì số tiền phải là số nguyên;\nLoại tiền là ngoại tệ thì số tiền có thể là số thập phân theo chuẩn quốc tế không format vidu: 1000.09 (Một nghìn phẩy không chín)'],
    ['TinhChatHangHoa', 'Tính chất hàng hóa', 'Text', null, 'Không', 'Nhập tính chất hàng hóa', '1 - Hàng hóa thông thường\n2 - Chiết khấu khuyến mại cùng dòng\n3 - Chiết khấu khuyến mại cả dòng sản phẩm\n4 - Ghi chú\n5 - Hàng hóa đặc trưng'],
    ['ChietKhau', 'Chiết khấu', 'True/False', null, 'Không', 'Nhập chiết khấu:\n- True: hóa đơn chiết khấu\n- False: hóa đơn thông thường\n- Bỏ trống: hóa đơn thông thường', '-True: hóa đơn chiết khấu\n-False: hóa đơn thông thường\n-Bỏ trống: hóa đơn thông thường'],
    ['CusEmail', 'Email khách hàng', 'Text', 150, 'Không', '- Nhập email khách hàng'],
    ['PaymentMethod', 'Phương thức thanh toán', 'Text', 150, 'Có', 'Nhập phương thức thanh toán:\n+ TM: Thanh toán bằng tiền mặt\n+ CK: Thanh toán chuyển khoản \n+ TM/CK: Thanh toán tiền mặt hoặc chuyển khoản\n+ TTD: Thanh toán thẻ tín dụng\n+ Nội bộ: Thanh toán nội bộ\n+ Bù trừ: Thanh toán bù trừ\n+ Không: Không có hình thức thanh toán'],
    ['PExtra01 đến PExtra10', 'Trường mở rộng của hàng hóa dịch vụ'],
    ['Extra01 đến Extra12', 'Trường mở rộng của hóa đơn']
];

/**
 * Định dạng timestamp (ms hoặc ISO) sang dd/mm/yyyy
 */
function formatInvoiceDateDDMMYYYY(timestamp) {
    if (!timestamp) {
        const now = new Date();
        return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    }
    const d = new Date(typeof timestamp === 'number' ? timestamp : String(timestamp));
    if (isNaN(d.getTime())) {
        const now = new Date();
        return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Tạo một dòng rỗng đủ 56 cột chuẩn theo thứ tự
 */
function createBlankInvoiceRow() {
    const row = {};
    for (const header of INVOICE_EXCEL_HEADERS) {
        row[header] = '';
    }
    return row;
}

/**
 * Bóc tách danh sách sản phẩm từ đơn hàng
 */
function parseInvoiceOrderProducts(productsJson) {
    if (!productsJson) return [];
    try {
        const list = typeof productsJson === 'string' ? JSON.parse(productsJson) : productsJson;
        if (Array.isArray(list)) {
            return list.map((p, idx) => ({
                product_id: p.product_id ?? p.id ?? (idx + 1),
                name: p.name || p.product_name || 'Sản phẩm',
                quantity: Math.max(1, parseInt(p.quantity, 10) || 1),
                price: Math.max(0, parseFloat(p.price || p.unit_price || 0)),
                size: p.size || p.weight || ''
            }));
        }
    } catch (e) {
        console.warn('Lỗi parse products cho hóa đơn:', e);
    }
    return [];
}

/**
 * Build địa chỉ đầy đủ từ các thành phần đơn hàng.
 * Ưu tiên: street_address + ward + district + province.
 * Fallback: trường address gốc nếu có.
 */
function buildFullAddress(order) {
    const parts = [];
    if (order.street_address) parts.push(String(order.street_address).trim());
    if (order.ward_name) parts.push(String(order.ward_name).trim());
    if (order.district_name) parts.push(String(order.district_name).trim());
    if (order.province_name) parts.push(String(order.province_name).trim());
    if (parts.length > 0) return parts.join(', ');
    // Fallback: dùng trường address gốc
    if (order.address) return String(order.address).trim();
    return '';
}

/**
 * Tạo workbook hóa đơn điện tử từ danh sách đơn hàng đã chọn
 */
function createInvoiceExcelWorkbook(orders) {
    const rows = [];
    let invoiceIndex = 1;

    orders.forEach(order => {
        const products = parseInvoiceOrderProducts(order.products);
        // Ngày hóa đơn = ngày export file (hôm nay), không phải ngày đặt hàng
        const orderDate = formatInvoiceDateDDMMYYYY(Date.now());
        const isBank = order.payment_method === 'bank_transfer' ||
            (typeof isOrderBankPayment === 'function' && isOrderBankPayment(order.payment_method));
        const paymentMethod = isBank ? 'CK' : 'TM';
        const currentMaHD = invoiceIndex++;

        if (products.length === 0) {
            // Dự phòng nếu đơn không có chi tiết sản phẩm
            const row = createBlankInvoiceRow();
            row['MaHD'] = currentMaHD;
            row['NgayHoaDon'] = orderDate;
            row['TenDonVi'] = 'Pancake/001096033681';
            row['TenNguoiMua'] = String(order.customer_name || '').trim();
            row['DiaChiKhachHang'] = buildFullAddress(order);
            row['MaHangHoa'] = String(order.id || order.order_id || 'SP');
            row['TenHangHoa'] = 'Sản phẩm theo đơn ' + (order.order_id || '');
            row['DonViTinh'] = 'Cái';
            row['SoLuong'] = 1;
            row['DonGia'] = Number(order.total_amount) || 0;
            row['ThanhTien'] = Number(order.total_amount) || 0;
            row['PhuongThucTT'] = paymentMethod;
            rows.push(row);
        } else {
            products.forEach(p => {
                const row = createBlankInvoiceRow();
                row['MaHD'] = currentMaHD;
                row['NgayHoaDon'] = orderDate;
                row['TenDonVi'] = 'Pancake/001096033681';
                row['TenNguoiMua'] = String(order.customer_name || '').trim();
                row['DiaChiKhachHang'] = buildFullAddress(order);
                row['MaHangHoa'] = String(p.product_id || 'SP');

                let productName = String(p.name || '').trim();
                if (p.size) {
                    productName += ` (${p.size})`;
                }
                row['TenHangHoa'] = productName;
                row['DonViTinh'] = 'Cái';
                row['SoLuong'] = p.quantity;
                row['DonGia'] = p.price;
                row['ThanhTien'] = p.quantity * p.price;
                row['PhuongThucTT'] = paymentMethod;
                rows.push(row);
            });
        }
    });

    // Tạo Workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Hóa đơn
    const wsInvoice = XLSX.utils.json_to_sheet(rows, { header: INVOICE_EXCEL_HEADERS });

    // Cấu hình độ rộng các cột chính cho dễ nhìn
    wsInvoice['!cols'] = [
        { wch: 8 },   // MaHD
        { wch: 15 },  // FKEY
        { wch: 13 },  // NgayHoaDon
        { wch: 15 },  // MaKhachHang
        { wch: 20 },  // TenNguoiMua
        { wch: 28 },  // TenDonVi
        { wch: 30 },  // DiaChiKhachHang
        { wch: 15 },  // MaSoThue
        { wch: 15 },  // CCCD
        { wch: 15 },  // SoHoChieu
        { wch: 15 },  // MaNganSach
        { wch: 14 },  // LoaiDacTrung
        { wch: 16 },  // HoaDonChietKhau
        { wch: 10 },  // ThueSuat
        { wch: 12 },  // TienThue
        { wch: 10 },  // TGTKhac
        { wch: 10 },  // TyGia
        { wch: 10 },  // LoaiTien
        { wch: 25 },  // TienBangChu
        { wch: 16 },  // TinhChatHanghoa
        { wch: 15 },  // MaHangHoa
        { wch: 40 },  // TenHangHoa
        { wch: 20 },  // GhiChu
        { wch: 12 },  // DonViTinh
        { wch: 10 },  // SoLuong
        { wch: 14 },  // DonGia
        { wch: 15 },  // ThanhTien
        { wch: 14 },  // TienChietKhau
        { wch: 12 },  // ChietKhau
        { wch: 20 },  // EmailKhachHang
        { wch: 15 },  // MailCC
        { wch: 16 }   // PhuongThucTT
    ];

    XLSX.utils.book_append_sheet(wb, wsInvoice, 'Hóa đơn');

    // Sheet 2: Mô tả (giữ nguyên cấu trúc template MauUploadHD.xlsx)
    const wsDesc = XLSX.utils.aoa_to_sheet(INVOICE_DESCRIPTION_ROWS);
    wsDesc['!cols'] = [
        { wch: 20 }, { wch: 25 }, { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 45 }, { wch: 55 }
    ];
    XLSX.utils.book_append_sheet(wb, wsDesc, 'Mô tả');

    const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `HoaDonDienTu_${nowStr}_${orders.length}don.xlsx`;

    return { wb, filename, rowCount: rows.length };
}

/**
 * Xuất file Excel hóa đơn điện tử và kích hoạt tải về máy
 */
async function exportOrdersToInvoiceExcel(orders) {
    if (!orders || orders.length === 0) {
        throw new Error('Không có đơn hàng nào để export');
    }

    if (typeof XLSX === 'undefined') {
        if (typeof loadXLSXLibrary === 'function') {
            await loadXLSXLibrary();
        } else {
            throw new Error('Thư viện Excel chưa được tải');
        }
    }

    const { wb, filename, rowCount } = createInvoiceExcelWorkbook(orders);

    // Kích hoạt tải file trực tiếp trên trình duyệt
    XLSX.writeFile(wb, filename);

    return {
        success: true,
        filename,
        orderCount: orders.length,
        itemCount: rowCount
    };
}

/**
 * Tạo buffer Excel từ danh sách đơn hàng (dùng cho cả tải trực tiếp lẫn lưu R2).
 * @param {Array} orders
 * @returns {{ buffer: Uint8Array, filename: string, rowCount: number }}
 */
function createInvoiceExcelBuffer(orders) {
    if (typeof XLSX === 'undefined') {
        throw new Error('Thư viện Excel chưa được tải');
    }

    const { wb, filename, rowCount } = createInvoiceExcelWorkbook(orders);
    const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return {
        buffer: new Uint8Array(arrayBuffer),
        filename,
        rowCount
    };
}

/**
 * Convert Uint8Array to base64 in chunks (non-blocking).
 */
function uint8ArrayToBase64Chunked(buffer) {
    return new Promise((resolve) => {
        const chunkSize = 8192;
        let binary = '';
        let offset = 0;

        function processChunk() {
            const end = Math.min(offset + chunkSize, buffer.length);
            for (let i = offset; i < end; i++) {
                binary += String.fromCharCode(buffer[i]);
            }
            offset = end;
            if (offset < buffer.length) {
                setTimeout(processChunk, 0);
            } else {
                resolve(btoa(binary));
            }
        }

        processChunk();
    });
}

/**
 * Export invoice Excel to R2 and save to database.
 * @param {Array} orders
 * @returns {{ success: boolean, exportId: number, filename: string, orderCount: number, itemCount: number }}
 */
async function exportInvoiceToR2AndSave(orders) {
    if (!orders || orders.length === 0) {
        throw new Error('Không có đơn hàng nào để export');
    }

    // Ensure XLSX is loaded (check in invoice-export context)
    if (typeof XLSX === 'undefined') {
        // Use the loadXLSXLibrary from orders-bulk-actions
        if (typeof loadXLSXLibrary === 'function') {
            await loadXLSXLibrary();
        } else {
            throw new Error('Thư viện Excel chưa được tải');
        }
    }

    const { buffer, filename, rowCount } = createInvoiceExcelBuffer(orders);
    const base64 = await uint8ArrayToBase64Chunked(buffer);

    const orderIds = orders.map(o => o.id);

    const response = await fetch(`${CONFIG.API_URL}?action=saveInvoiceExport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fileName: filename,
            fileData: base64,
            orderIds: orderIds,
            orderCount: orders.length,
            invoiceRowCount: rowCount
        })
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || 'Không thể lưu file hóa đơn điện tử');
    }

    return {
        success: true,
        exportId: data.exportId,
        filename,
        orderCount: orders.length,
        itemCount: rowCount
    };
}
