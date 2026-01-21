// Check CTV phone number
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function checkCTVPhone() {
    try {
        const referralCode = 'CTV100004';
        
        const result = await client.execute({
            sql: 'SELECT referral_code, full_name, phone, custom_slug FROM ctv WHERE referral_code = ?',
            args: [referralCode]
        });

        if (result.rows.length === 0) {
            console.log('❌ Không tìm thấy CTV:', referralCode);
            return;
        }

        const ctv = result.rows[0];
        console.log('\n✅ Thông tin CTV:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Mã CTV:', ctv.referral_code);
        console.log('Tên:', ctv.full_name);
        console.log('SĐT:', ctv.phone);
        console.log('Custom Slug:', ctv.custom_slug || '(chưa có)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n📝 Để test xác minh, nhập SĐT:', ctv.phone);
        
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    } finally {
        client.close();
    }
}

checkCTVPhone();
