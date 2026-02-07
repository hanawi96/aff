/**
 * Test Phone Number Search
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

async function testPhoneSearch() {
    console.log('📞 Testing Phone Number Search...\n');

    const tests = [
        { phone: '0123456789', desc: 'Test phone (may not exist)' },
        { phone: '0901234567', desc: 'Test phone from database' },
        { phone: '0386190596', desc: 'Test phone from CTV table' }
    ];

    for (const test of tests) {
        console.log(`📤 Testing: ${test.desc}`);
        console.log(`   Phone: ${test.phone}`);
        
        const result = await sendCommand(test.phone);
        
        if (result.ok) {
            console.log(`   ✅ Command sent successfully\n`);
        } else {
            console.error(`   ❌ Failed:`, result, '\n');
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('✅ All tests completed!');
    console.log('\n📱 Check your Telegram for results');
    console.log('Expected behavior:');
    console.log('- If phone is CTV → Show CTV info');
    console.log('- If phone is customer → Show customer history');
    console.log('- If phone not found → Show "not found" message');
}

testPhoneSearch();
