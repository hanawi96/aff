/**
 * Backfill province_name / ward_name cho đơn thiếu tên.
 * Đồng thời chuẩn hóa province_id / ward_id về string pad (01, 00329).
 *
 * Chạy: node database/backfill-missing-address-names.js
 */
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const url = process.env.TURSO_DATABASE_URL || process.env.TURSO_CONNECTION_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
    console.error('❌ Thiếu TURSO_DATABASE_URL / TURSO_AUTH_TOKEN');
    process.exit(1);
}

const client = createClient({ url, authToken, intMode: 'number' });

function padProvinceId(raw) {
    if (raw == null || raw === '') return null;
    const n = parseInt(String(raw).replace(/\.0+$/, ''), 10);
    if (!Number.isFinite(n) || n < 0) return String(raw).trim() || null;
    return String(n).padStart(2, '0');
}

function padWardId(raw) {
    if (raw == null || raw === '') return null;
    const n = parseInt(String(raw).replace(/\.0+$/, ''), 10);
    if (!Number.isFinite(n) || n < 0) return String(raw).trim() || null;
    return String(n).padStart(5, '0');
}

function isBlank(v) {
    return v == null || String(v).trim() === '';
}

function parseAddressString(address) {
    if (!address || typeof address !== 'string') {
        return { province: '', ward: '', detail: '' };
    }
    const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 4) {
        return {
            province: parts[parts.length - 1],
            ward: parts[parts.length - 3],
            detail: parts.slice(0, parts.length - 3).join(', ')
        };
    }
    if (parts.length === 3) {
        return { province: parts[2], ward: parts[1], detail: parts[0] };
    }
    if (parts.length === 2) {
        return { province: parts[1], ward: '', detail: parts[0] };
    }
    return { province: '', ward: '', detail: parts[0] || address };
}

function loadTreeMaps() {
    const raw = JSON.parse(readFileSync(join(root, 'public/assets/data/tree_2.json'), 'utf8'));
    const provinceByCode = new Map();
    const wardByKey = new Map();
    for (const p of raw) {
        const pCode = String(p.code);
        const pName = p.fullName || p.name || '';
        provinceByCode.set(pCode, pName);
        if (Array.isArray(p.wards)) {
            for (const w of p.wards) {
                const wCode = String(w.code);
                const shortLabel = (w.fullName || '').includes(',')
                    ? w.fullName.split(',')[0].trim()
                    : (w.fullName || w.name || '');
                wardByKey.set(`${pCode}-${wCode}`, shortLabel);
            }
        }
    }
    return { provinceByCode, wardByKey };
}

async function main() {
    console.log('🔍 Backfill province_name / ward_name cho đơn thiếu tên\n');

    const { provinceByCode, wardByKey } = loadTreeMaps();
    console.log(`📦 tree_2: ${provinceByCode.size} tỉnh, ${wardByKey.size} phường/xã\n`);

    const list = await client.execute(`
        SELECT id, order_id, customer_name, customer_phone, status,
               province_id, province_name, ward_id, ward_name,
               street_address, address, created_at_unix
        FROM orders
        WHERE (province_id IS NOT NULL OR ward_id IS NOT NULL OR street_address IS NOT NULL OR address IS NOT NULL)
          AND (
            province_name IS NULL OR TRIM(COALESCE(province_name, '')) = ''
            OR ward_name IS NULL OR TRIM(COALESCE(ward_name, '')) = ''
          )
        ORDER BY created_at_unix DESC
    `);

    const rows = list.rows || [];
    console.log(`📋 Tìm thấy ${rows.length} đơn thiếu tên tỉnh và/hoặc phường\n`);
    console.log('='.repeat(100));

    if (rows.length === 0) {
        console.log('✅ Không có đơn nào cần backfill.');
        client.close();
        return;
    }

    // Hiển thị đầy đủ trước khi sửa
    for (const r of rows) {
        console.log(`\n#${r.id}  ${r.order_id}  [${r.status}]  ${r.customer_name} / ${r.customer_phone}`);
        console.log(`  province_id=${r.province_id}  province_name=${r.province_name ?? 'NULL'}`);
        console.log(`  ward_id=${r.ward_id}  ward_name=${r.ward_name ?? 'NULL'}`);
        console.log(`  street_address=${r.street_address ?? 'NULL'}`);
        console.log(`  address=${r.address ?? 'NULL'}`);
    }

    console.log('\n' + '='.repeat(100));
    console.log('\n🔧 Bắt đầu backfill...\n');

    let updated = 0;
    let skipped = 0;
    const failed = [];

    for (const r of rows) {
        const pId = padProvinceId(r.province_id);
        const wId = padWardId(r.ward_id);
        let provinceName = !isBlank(r.province_name) ? String(r.province_name).trim() : '';
        let wardName = !isBlank(r.ward_name) ? String(r.ward_name).trim() : '';
        let street = !isBlank(r.street_address) ? String(r.street_address).trim() : '';

        // 1) Lookup tree_2 theo ID đã pad
        if (pId && provinceByCode.has(pId) && !provinceName) {
            provinceName = provinceByCode.get(pId);
        }
        if (pId && wId) {
            const key = `${pId}-${wId}`;
            if (wardByKey.has(key) && !wardName) {
                wardName = wardByKey.get(key);
            }
        }

        // 2) Parse chuỗi address nếu vẫn thiếu
        if ((!provinceName || !wardName || !street) && r.address) {
            const parsed = parseAddressString(String(r.address));
            if (!provinceName && parsed.province) provinceName = parsed.province;
            if (!wardName && parsed.ward) wardName = parsed.ward;
            if (!street && parsed.detail) street = parsed.detail;
        }

        const stillMissingProvince = !provinceName;
        const stillMissingWard = !wardName;

        if (stillMissingProvince && stillMissingWard) {
            skipped++;
            failed.push({
                id: r.id,
                order_id: r.order_id,
                reason: 'Không resolve được tên từ ID lẫn address'
            });
            console.log(`⚠️  SKIP ${r.order_id}: không resolve được`);
            continue;
        }

        // Chỉ update các field đang thiếu / ID cần pad
        const newProvinceId = pId || (r.province_id != null ? String(r.province_id) : null);
        const newWardId = wId || (r.ward_id != null ? String(r.ward_id) : null);
        const newProvinceName = provinceName || r.province_name || null;
        const newWardName = wardName || r.ward_name || null;
        const newStreet = street || r.street_address || null;

        await client.execute({
            sql: `
                UPDATE orders
                SET province_id = ?,
                    province_name = ?,
                    ward_id = ?,
                    ward_name = ?,
                    street_address = COALESCE(?, street_address)
                WHERE id = ?
            `,
            args: [newProvinceId, newProvinceName, newWardId, newWardName, newStreet, r.id]
        });

        updated++;
        console.log(
            `✅ ${r.order_id}: ` +
            `province="${newProvinceName}" (${newProvinceId}) | ` +
            `ward="${newWardName}" (${newWardId}) | ` +
            `street="${newStreet || ''}"`
        );
    }

    // Verify còn thiếu
    const remain = await client.execute(`
        SELECT COUNT(*) AS c
        FROM orders
        WHERE (province_id IS NOT NULL OR ward_id IS NOT NULL)
          AND (
            province_name IS NULL OR TRIM(COALESCE(province_name, '')) = ''
            OR ward_name IS NULL OR TRIM(COALESCE(ward_name, '')) = ''
          )
    `);

    console.log('\n' + '='.repeat(100));
    console.log('📊 KẾT QUẢ');
    console.log(`   Đã cập nhật : ${updated}`);
    console.log(`   Bỏ qua      : ${skipped}`);
    console.log(`   Còn thiếu   : ${remain.rows[0]?.c ?? '?'}`);
    if (failed.length) {
        console.log('\n⚠️  Đơn không backfill được:');
        failed.forEach((f) => console.log(`   - ${f.order_id} (#${f.id}): ${f.reason}`));
    }
    console.log('='.repeat(100));

    client.close();
}

main().catch((err) => {
    console.error('❌ Lỗi:', err);
    process.exit(1);
});
