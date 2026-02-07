/**
 * Test Inline Buttons in Messages
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

async function testInlineButtons() {
    console.log('🔘 Testing Inline Buttons in Messages...\n');

    const tests = [
        { 
            cmd: 'CTV100004', 
            desc: 'CTV Info with buttons',
            buttons: ['📦 Xem Tất Cả Đơn', '📞 Gọi', '💬 Nhắn Tin', '🏆 Top CTV', '👥 Menu CTV']
        },
        { 
            cmd: '/menu', 
            desc: 'Main menu',
            action: 'Click "👥 CTV" → "📊 Tổng Quan"',
            buttons: ['🏆 Top CTV', '🆕 CTV Mới', '💰 Hoa Hồng']
        },
        { 
            cmd: '/menu', 
            desc: 'Main menu',
            action: 'Click "👥 CTV" → "🏆 Top CTV"',
            buttons: ['👤 Xem #1', '📊 Tổng Quan', '💰 Hoa Hồng']
        }
    ];

    for (const test of tests) {
        console.log(`📤 Test: ${test.desc}`);
        console.log(`   Command: ${test.cmd}`);
        if (test.action) {
            console.log(`   Action: ${test.action}`);
        }
        if (test.buttons) {
            console.log(`   Expected buttons: ${test.buttons.join(', ')}`);
        }
        
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
    console.log('1. CTV info message has action buttons');
    console.log('2. Tổng Quan has quick action buttons');
    console.log('3. Top CTV has "Xem #1" button');
    console.log('4. All buttons are clickable and work');
    console.log('\n💡 Try clicking the buttons to test functionality!');
}

testInlineButtons();
