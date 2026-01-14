// Normalize phone number
export function normalizePhone(phone) {
    if (!phone) return '';
    let normalized = phone.toString().trim().replace(/[\s\-]/g, '');
    if (normalized.startsWith('0')) {
        normalized = normalized.substring(1);
    }
    return normalized;
}
