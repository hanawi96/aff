/**
 * Test Order Inline Buttons
 */

const BOT_TOKEN = '7585519498:AAFHt6QMqI-zfVVnbQW1E_fxzQ1kNUsiEQU';
const CHAT_ID = '5816975483';

async function sendCommand(command) {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: CHAT_ID,
            text: command
        })
    });
    return await response.json();
}

async function testOrderButtons() {
    console.log('🔘 Testing Order Inline Buttons...\n');

    const tests = [
        { 
            cmd: '/t', 
            desc: 'Đơn hàng hôm nay',
            buttons: ['📦 Đơn Gần Nhất', '📊 Thống Kê', '💰 Doanh Thu Hôm Qua']
        },
        { 
            cmd: '/recent', 
            desc: '10 đơn gần nhất',
            buttons: ['🔍 Xem Đơn #1', '🔍 Xem Đơn #2', '📊 Thống Kê', '📅 Hôm Nay']
        },
        { 
            cmd: '/stats', 
            desc: 'Thống kê tổng quan',
            buttons: ['📅 Hôm Nay', '📅 Hôm Qua', '📆 Tuần Này', '📆 Tháng Này', '📦 Đơn Gần Nhất']
        },
        { 
            cmd: '0901234567', 
            desc: 'Lịch sử khách hàng',
            buttons: ['📞 Gọi Khách', '💬 Nhắn Tin', '🔍 Xem Đơn #1', '🔍 Xem Đơn #2']
        },
        { 
            cmd: '/w', 
            desc: 'Tuần này',
            buttons: ['📅 Hôm Nay', '📆 Tháng Này', '📊 Thống Kê']
        },
        { 
            cmd: '/m', 
            desc: 'Tháng này',
            buttons: ['📅 Hôm Nay', '📆 Tuần Này', '📊 Thống Kê']
        }
    ];

    for (const test of tests) {
        console.log(`📤 Test: ${test.desc}`);
        console.log(`   Command: ${test.cmd}`);
        console.log(`   Expected buttons: ${test.buttons.join(', ')}`);
        
        const result = await sendCommand(test.cmd);
        
        if (result.ok) {
            console.log(`   ✅ Success\n`);
        } else {
            console.error(`   ❌ Failed:`, result, '\n');
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('✅ All tests completed!\n');
    console.log('📱 Check your Telegram and verify:');
    console.log('1. Đơn hàng hôm nay has navigation buttons');
    console.log('2. 10 đơn gần nhất has quick view buttons');
    console.log('3. Lịch sử khách has action buttons');
    console.log('4. Thống kê has comparison buttons');
    console.log('5. Tuần/Tháng has navigation buttons');
    console.log('\n💡 Try clicking the buttons to test functionality!');
    console.log('\n🎯 BONUS: Place a test order to see new order notification with buttons!');
}

testOrderButtons();
