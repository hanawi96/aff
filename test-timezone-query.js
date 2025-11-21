// Test timezone query
const now = new Date();
const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const todayStart = new Date(vnDateStr + 'T00:00:00+07:00');
const todayEnd = new Date(vnDateStr + 'T23:59:59.999+07:00');

console.log('=== Test Timezone Query ===');
console.log('Today VN Date:', vnDateStr);
console.log('Start (UTC):', todayStart.toISOString());
console.log('End (UTC):', todayEnd.toISOString());
console.log('Start Unix (ms):', todayStart.getTime());
console.log('End Unix (ms):', todayEnd.getTime());
console.log('\n=== SQL Query ===');
console.log(`SELECT order_id, created_at_unix, datetime(created_at_unix/1000, 'unixepoch', '+7 hours') as vn_time`);
console.log(`FROM orders`);
console.log(`WHERE created_at_unix >= ${todayStart.getTime()}`);
console.log(`  AND created_at_unix <= ${todayEnd.getTime()}`);
console.log(`ORDER BY created_at_unix DESC;`);
