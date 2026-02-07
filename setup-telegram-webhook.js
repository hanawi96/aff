/**
 * Script để setup Telegram webhook
 * Chạy: node setup-telegram-webhook.js
 */

import dotenv from 'dotenv';
dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// URL của Cloudflare Worker (thay đổi theo domain của bạn)
const WEBHOOK_URL = process.argv[2] || 'https://ctv-api.yendev96.workers.dev/api/telegram/webhook';

async function setupWebhook() {
    try {
        console.log('🚀 Đang setup Telegram webhook...\n');

        if (!TELEGRAM_BOT_TOKEN) {
            console.error('❌ Thiếu TELEGRAM_BOT_TOKEN trong .env');
            return;
        }

        console.log('📍 Webhook URL:', WEBHOOK_URL);
        console.log('');

        // Set webhook
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: WEBHOOK_URL,
                allowed_updates: ['message', 'callback_query']
            })
        });

        const result = await response.json();

        if (result.ok) {
            console.log('✅ Webhook đã được setup thành công!');
            console.log('');
            console.log('📱 Bây giờ bạn có thể gõ lệnh trên Telegram:');
            console.log('   /today   - Xem đơn hàng hôm nay');
            console.log('   /stats   - Xem thống kê tổng quan');
            console.log('   /week    - Thống kê tuần này');
            console.log('   /month   - Thống kê tháng này');
            console.log('   /recent  - 10 đơn hàng gần nhất');
            console.log('   /help    - Xem tất cả lệnh');
            console.log('');
        } else {
            console.error('❌ Lỗi setup webhook:');
            console.error(result);
        }

        // Get webhook info
        console.log('📊 Kiểm tra webhook info...\n');
        const infoResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
        const infoResult = await infoResponse.json();

        if (infoResult.ok) {
            console.log('Webhook Info:');
            console.log('- URL:', infoResult.result.url);
            console.log('- Pending updates:', infoResult.result.pending_update_count);
            if (infoResult.result.last_error_message) {
                console.log('- Last error:', infoResult.result.last_error_message);
            }
        }

    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    }
}

console.log('═══════════════════════════════════════════════');
console.log('🤖 SETUP TELEGRAM WEBHOOK');
console.log('═══════════════════════════════════════════════\n');

setupWebhook();
