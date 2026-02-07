/**
 * Test Telegram Shortcuts
 * Test các lệnh shortcut: /t /y /w /m
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

async function testShortcuts() {
    console.log('⭐⭐⭐ Testing Telegram Shortcuts...\n');

    const commands = [
        { cmd: '/t', desc: 'Hôm nay' },
        { cmd: '/y', desc: 'Hôm qua' },
        { cmd: '/w', desc: 'Tuần này' },
        { cmd: '/m', desc: 'Tháng này' }
    ];

    for (const { cmd, desc } of commands) {
        console.log(`📤 Sending: ${cmd} (${desc})`);
        const result = await sendCommand(cmd);
        
        if (result.ok) {
            console.log(`✅ ${cmd} sent successfully`);
        } else {
            console.error(`❌ ${cmd} failed:`, result);
        }
        
        // Wait 1 second between commands
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n✅ All shortcuts tested!');
    console.log('📱 Check your Telegram for results');
}

testShortcuts();
