/**
 * Chuẩn hóa cột size (cân/size tay) của order_items:
 * chuỗi placeholder "chưa có" hoặc rỗng → NULL trong DB.
 */
export function normalizeOrderItemSize(value) {
    if (value == null) return null;
    const s = String(value).trim();
    if (s === '') return null;
    const lower = s.toLowerCase();
    // Legacy: đã lưu tiếng Việt hoặc không dấu
    if (lower === 'chưa có' || lower === 'chua co' || lower === 'chua có') return null;
    return s;
}
