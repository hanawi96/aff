/**
 * Test CTV Menu & Auto-detection
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

async function testCTVFeatures() {
    console.log('👥 Testing CTV Menu & Auto-detection...\n');

    const tests = [
        { cmd: '/menu', desc: 'Open main menu (should have CTV button)' },
        { cmd: 'CTV100004', desc: 'Auto-detect CTV code' },
        { cmd: '0901234504', desc: 'Auto-detect phone (CTV or customer)' }
    ];

    for (const { cmd, desc } of tests) {
        console.log(`📤 Testing: ${desc}`);
        console.log(`   Command: ${cmd}`);
        
        const result = await sendCommand(cmd);
        
        if (result.ok) {
            console.log(`   ✅ Success\n`);
        } else {
            console.error(`   ❌ Failed:`, result, '\n');
        }
        
        // Wait 2 seconds between commands
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('✅ All tests completed!');
    console.log('\n📱 Check your Telegram:');
    console.log('1. Main menu should have "👥 CTV" button');
    console.log('2. Click CTV button to see CTV menu');
    console.log('3. Try buttons: Tổng Quan, Top CTV, etc.');
    console.log('4. Try typing: CTV100004 or 0901234504');
}

testCTVFeatures();
