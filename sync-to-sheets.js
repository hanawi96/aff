// Script để đồng bộ dữ liệu từ D1 sang Google Sheets
// Chạy: node sync-to-sheets.js

const API_URL = 'https://ctv-api.yendev96.workers.dev';

async function syncAllCTV() {
    console.log('🔄 Bắt đầu đồng bộ dữ liệu từ D1 sang Google Sheets...\n');

    try {
        // 1. Lấy tất cả CTV từ D1
        const response = await fetch(`${API_URL}?action=getAllCTV`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to get CTV data');
        }

        const ctvList = data.ctvList || [];
        console.log(`📊 Tìm thấy ${ctvList.length} CTV trong D1\n`);

        // 2. Đồng bộ từng CTV
        let successCount = 0;
        let errorCount = 0;

        for (const ctv of ctvList) {
            try {
                const syncResponse = await fetch(`${API_URL}/api/ctv/update-commission`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        referralCode: ctv.referralCode,
                        commissionRate: ctv.commissionRate || 0.1
                    })
                });

                const syncResult = await syncResponse.json();

                if (syncResult.success) {
                    console.log(`✅ ${ctv.referralCode} - ${ctv.fullName} (${(ctv.commissionRate * 100).toFixed(0)}%)`);
                    successCount++;
                } else {
                    console.log(`❌ ${ctv.referralCode} - Error: ${syncResult.error}`);
                    errorCount++;
                }

                // Delay để tránh rate limit
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.log(`❌ ${ctv.referralCode} - Error: ${error.message}`);
                errorCount++;
            }
        }

        console.log('\n========================================');
        console.log('📊 KẾT QUẢ ĐỒNG BỘ');
        console.log('========================================');
        console.log(`✅ Thành công: ${successCount}`);
        console.log(`❌ Lỗi: ${errorCount}`);
        console.log(`📊 Tổng: ${ctvList.length}`);
        console.log('========================================');

    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        process.exit(1);
    }
}

// Chạy
syncAllCTV();
