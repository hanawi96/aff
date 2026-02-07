/**
 * Daily Report Service
 * Gửi báo cáo tự động hàng ngày lúc 21h
 */

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Gửi báo cáo hàng ngày
 */
export async function sendDailyReport(env) {
    try {
        console.log('📊 Generating daily report...');

        const vnNow = new Date(Date.now() + VN_OFFSET_MS);
        const startOfToday = Date.UTC(
            vnNow.getUTCFullYear(),
            vnNow.getUTCMonth(),
            vnNow.getUTCDate(),
            0, 0, 0, 0
        ) - VN_OFFSET_MS;
        const endOfToday = startOfToday + 24 * 60 * 60 * 1000;

        const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

        // Query dữ liệu
        const [todayOrders, yesterdayOrders, topProducts] = await Promise.all([
            // Đơn hàng hôm nay
            env.DB.prepare(`
                SELECT order_id, customer_name, customer_phone, total_amount, 
                       payment_method, referral_code, commission
                FROM orders 
                WHERE created_at_unix >= ? AND created_at_unix < ?
                ORDER BY created_at_unix DESC
            `).bind(startOfToday, endOfToday).all(),

            // Đơn hàng hôm qua
            env.DB.prepare(`
                SELECT total_amount FROM orders 
                WHERE created_at_unix >= ? AND created_at_unix < ?
            `).bind(startOfYesterday, startOfToday).all(),

            // Top sản phẩm bán chạy hôm nay
            env.DB.prepare(`
                SELECT product_name, SUM(quantity) as total_qty, COUNT(*) as order_count
                FROM order_items 
                WHERE created_at_unix >= ? AND created_at_unix < ?
                GROUP BY product_name
                ORDER BY total_qty DESC
                LIMIT 5
            `).bind(startOfToday, endOfToday).all()
        ]);

        // Tính toán
        const todayCount = todayOrders.results.length;
        const todayRevenue = todayOrders.results.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        const todayAvg = todayCount > 0 ? Math.round(todayRevenue / todayCount) : 0;

        const yesterdayCount = yesterdayOrders.results.length;
        const yesterdayRevenue = yesterdayOrders.results.reduce((sum, o) => sum + (o.total_amount || 0), 0);

        // Tính % thay đổi
        const revenueChange = yesterdayRevenue > 0 
            ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100).toFixed(1)
            : 0;
        const orderChange = yesterdayCount > 0
            ? ((todayCount - yesterdayCount) / yesterdayCount * 100).toFixed(1)
            : 0;

        // Đếm khách hàng mới (lần đầu mua)
        const newCustomers = await countNewCustomers(todayOrders.results, env);

        // Đếm đơn có CTV
        const ctvOrders = todayOrders.results.filter(o => o.referral_code).length;
        const totalCommission = todayOrders.results.reduce((sum, o) => sum + (o.commission || 0), 0);

        // Tạo message
        const message = createDailyReportMessage({
            date: vnNow.toLocaleDateString('vi-VN'),
            todayCount,
            todayRevenue,
            todayAvg,
            yesterdayCount,
            yesterdayRevenue,
            revenueChange,
            orderChange,
            topProducts: topProducts.results,
            newCustomers,
            ctvOrders,
            totalCommission,
            orders: todayOrders.results.slice(0, 5) // 5 đơn gần nhất
        });

        // Gửi qua Telegram
        await sendTelegramMessage(env.TELEGRAM_CHAT_ID, message, env);

        console.log('✅ Daily report sent successfully');
        return true;

    } catch (error) {
        console.error('❌ Error sending daily report:', error);
        return false;
    }
}

/**
 * Đếm khách hàng mới
 */
async function countNewCustomers(todayOrders, env) {
    let newCount = 0;

    for (const order of todayOrders) {
        const { results } = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM orders 
            WHERE customer_phone = ? AND created_at_unix < ?
        `).bind(order.customer_phone, order.created_at_unix || Date.now()).all();

        if (results[0].count === 0) {
            newCount++;
        }
    }

    return newCount;
}

/**
 * Tạo nội dung báo cáo
 */
function createDailyReportMessage(data) {
    const revenueIcon = data.revenueChange >= 0 ? '📈' : '📉';
    const orderIcon = data.orderChange >= 0 ? '📈' : '📉';
    const revenueSign = data.revenueChange >= 0 ? '+' : '';
    const orderSign = data.orderChange >= 0 ? '+' : '';

    let message = `📊 <b>BÁO CÁO CUỐI NGÀY</b>\n`;
    message += `📅 ${data.date}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Tổng quan
    message += `💰 <b>TỔNG QUAN</b>\n`;
    message += `📦 Đơn hàng: <b>${data.todayCount}</b> ${orderIcon} ${orderSign}${data.orderChange}%\n`;
    message += `💵 Doanh thu: <b>${data.todayRevenue.toLocaleString('vi-VN')}đ</b> ${revenueIcon} ${revenueSign}${data.revenueChange}%\n`;
    message += `📊 TB/đơn: <b>${data.todayAvg.toLocaleString('vi-VN')}đ</b>\n\n`;

    // So sánh hôm qua
    message += `📉 <b>SO VỚI HÔM QUA</b>\n`;
    message += `Đơn hàng: ${data.yesterdayCount} → ${data.todayCount}\n`;
    message += `Doanh thu: ${data.yesterdayRevenue.toLocaleString('vi-VN')}đ → ${data.todayRevenue.toLocaleString('vi-VN')}đ\n\n`;

    // Top sản phẩm
    if (data.topProducts && data.topProducts.length > 0) {
        message += `🏆 <b>TOP SẢN PHẨM BÁN CHẠY</b>\n`;
        data.topProducts.forEach((product, index) => {
            message += `${index + 1}. ${product.product_name}\n`;
            message += `   • Đã bán: ${product.total_qty} sản phẩm (${product.order_count} đơn)\n`;
        });
        message += `\n`;
    }

    // Khách hàng mới
    if (data.newCustomers > 0) {
        message += `🌟 <b>KHÁCH HÀNG MỚI</b>\n`;
        message += `Có <b>${data.newCustomers}</b> khách hàng mới hôm nay!\n\n`;
    }

    // CTV
    if (data.ctvOrders > 0) {
        message += `🤝 <b>CỘNG TÁC VIÊN</b>\n`;
        message += `Đơn từ CTV: <b>${data.ctvOrders}</b>\n`;
        message += `Tổng hoa hồng: <b>${data.totalCommission.toLocaleString('vi-VN')}đ</b>\n\n`;
    }

    // Đơn hàng gần nhất
    if (data.orders && data.orders.length > 0) {
        message += `📋 <b>5 ĐƠN HÀNG GẦN NHẤT</b>\n`;
        data.orders.forEach((order, index) => {
            message += `${index + 1}. <code>${order.order_id}</code> - ${order.customer_name}\n`;
            message += `   💰 ${order.total_amount.toLocaleString('vi-VN')}đ\n`;
        });
        message += `\n`;
    }

    // Footer
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🏪 <i>Vòng Dâu Tằm By Ánh</i>\n`;
    message += `⏰ Báo cáo tự động lúc 21:00`;

    return message;
}

/**
 * Gửi tin nhắn Telegram
 */
async function sendTelegramMessage(chatId, message, env) {
    try {
        // Tự động thêm Menu button
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🏠 Menu', callback_data: 'main_menu' }
                ]
            ]
        };
        
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                reply_markup: keyboard
            })
        });
    } catch (error) {
        console.error('❌ Error sending message:', error);
    }
}
