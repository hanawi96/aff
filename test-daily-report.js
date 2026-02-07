/**
 * Test Daily Report Command
 * Gửi lệnh /report để test báo cáo tự động
 */

const BOT_TOKEN = '7585519498:AAFHt6QMqI-zfVVnbQW1E_fxzQ1kNUsiEQU';
const CHAT_ID = '5816975483';

async function testReportCommand() {
    try {
        console.log('📊 Testing /report command...');
        
        // Gửi lệnh /report
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: '/report'
            })
        });

        const result = await response.json();
        
        if (result.ok) {
            console.log('✅ Command sent successfully!');
            console.log('📱 Check your Telegram for the daily report');
        } else {
            console.error('❌ Error:', result);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testReportCommand();
