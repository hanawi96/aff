/**
 * Telegram Bot Commands Handler
 * Xử lý các lệnh admin từ Telegram
 */

// Vietnam timezone offset (UTC+7)
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Helper: Get Vietnam time from timestamp
 */
function getVNTime(timestamp = Date.now()) {
    return new Date(timestamp + VN_OFFSET_MS);
}

/**
 * Helper: Get start of day in Vietnam timezone
 */
function getVNStartOfDay(vnDate) {
    return Date.UTC(
        vnDate.getUTCFullYear(),
        vnDate.getUTCMonth(),
        vnDate.getUTCDate(),
        0, 0, 0, 0
    ) - VN_OFFSET_MS;
}

/**
 * Helper: Get start of day N days ago in Vietnam timezone
 */
function getVNStartOfDayOffset(daysOffset = 0) {
    const vnNow = getVNTime();
    const targetDate = new Date(vnNow.getTime());
    targetDate.setUTCDate(vnNow.getUTCDate() - daysOffset);
    return getVNStartOfDay(targetDate);
}

/**
 * Helper: Get start of month in Vietnam timezone
 */
function getVNStartOfMonth(vnDate) {
    return Date.UTC(
        vnDate.getUTCFullYear(),
        vnDate.getUTCMonth(),
        1,
        0, 0, 0, 0
    ) - VN_OFFSET_MS;
}

/**
 * Helper: Get start of week (Monday) in Vietnam timezone
 */
function getVNStartOfWeek(vnDate) {
    const dayOfWeek = vnDate.getUTCDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return Date.UTC(
        vnDate.getUTCFullYear(),
        vnDate.getUTCMonth(),
        vnDate.getUTCDate() - daysSinceMonday,
        0, 0, 0, 0
    ) - VN_OFFSET_MS;
}

/**
 * Xử lý webhook từ Telegram
 */
export async function handleTelegramWebhook(update, env) {
    try {
        if (!update.message) {
            return new Response('OK', { status: 200 });
        }

        const chatId = update.message.chat.id;
        const text = update.message.text;
        const from = update.message.from;

        // Bỏ qua tin nhắn từ bot
        if (from.is_bot) {
            return new Response('OK', { status: 200 });
        }

        // Chỉ xử lý lệnh (bắt đầu bằng /)
        if (!text || !text.startsWith('/')) {
            return new Response('OK', { status: 200 });
        }

        // Kiểm tra quyền admin (chỉ cho phép Chat ID của bạn)
        if (chatId.toString() !== env.TELEGRAM_CHAT_ID) {
            await sendTelegramMessage(chatId, "❌ Bạn không có quyền sử dụng bot này.", env);
            return new Response('OK', { status: 200 });
        }

        // Xử lý lệnh
        await handleAdminCommand(chatId, text, env);

        return new Response('OK', { status: 200 });

    } catch (error) {
        console.error('❌ Error handling Telegram webhook:', error);
        return new Response('ERROR', { status: 500 });
    }
}

/**
 * Xử lý các lệnh admin
 */
async function handleAdminCommand(chatId, command, env) {
    try {
        const trimmedCommand = command.trim();
        const parts = trimmedCommand.split(' ');
        const cmd = parts[0].toLowerCase();

        switch (cmd) {
            case '/start':
            case '/help':
                await sendHelpMessage(chatId, env);
                break;

            case '/today':
                await sendTodayOrders(chatId, env);
                break;

            case '/stats':
                await sendStatistics(chatId, env);
                break;

            case '/week':
                await sendWeeklyStats(chatId, env);
                break;

            case '/month':
                await sendMonthlyStats(chatId, env);
                break;

            case '/yesterday':
                await sendYesterdayRevenue(chatId, env);
                break;

            case '/7days':
            case '/last7days':
                await sendLast7DaysRevenue(chatId, env);
                break;

            case '/30days':
            case '/last30days':
                await sendLast30DaysRevenue(chatId, env);
                break;

            case '/revenue':
                await sendRevenueQuickView(chatId, env);
                break;

            case '/recent':
                await sendRecentOrders(chatId, env);
                break;

            case '/find':
                if (parts[1]) {
                    await findOrder(chatId, parts[1], env);
                } else {
                    await sendTelegramMessage(chatId, "❌ Vui lòng nhập mã đơn hàng\nVí dụ: /find VDT001", env);
                }
                break;

            case '/customer':
                if (parts[1]) {
                    await findCustomerHistory(chatId, parts[1], env);
                } else {
                    await sendTelegramMessage(chatId, "❌ Vui lòng nhập số điện thoại\nVí dụ: /customer 0123456789", env);
                }
                break;

            default:
                await sendTelegramMessage(chatId, `❌ Lệnh không hợp lệ: "${cmd}"\nGõ /help để xem danh sách lệnh.`, env);
        }

    } catch (error) {
        console.error('❌ Error handling admin command:', error);
        await sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`, env);
    }
}

/**
 * Gửi tin nhắn help
 */
async function sendHelpMessage(chatId, env) {
    const helpText = `
🤖 <b>LỆNH ADMIN - Vòng Dâu Tằm By Ánh</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 <b>XEM ĐƠN HÀNG:</b>
/today - Đơn hàng hôm nay
/yesterday - Doanh thu hôm qua
/week - Thống kê tuần này
/month - Thống kê tháng này
/recent - 10 đơn hàng gần nhất
/stats - Thống kê tổng quan

💰 <b>XEM DOANH THU:</b>
/revenue - Tổng quan doanh thu
/7days - Doanh thu 7 ngày qua
/30days - Doanh thu 30 ngày qua

🔍 <b>TÌM KIẾM:</b>
/find VDT001 - Chi tiết đơn hàng
/customer 0123456789 - Lịch sử khách hàng

💡 <b>MẸO:</b> Gõ lệnh bất kỳ để quản lý shop nhanh chóng!
    `;

    await sendTelegramMessage(chatId, helpText, env);
}

/**
 * Xem đơn hàng hôm nay
 */
async function sendTodayOrders(chatId, env) {
    try {
        const vnNow = getVNTime();
        const startOfDay = getVNStartOfDay(vnNow);
        const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

        const { results: orders } = await env.DB.prepare(`
            SELECT order_id, customer_name, customer_phone, total_amount, 
                   payment_method, created_at_unix
            FROM orders 
            WHERE created_at_unix >= ? AND created_at_unix < ?
            ORDER BY created_at_unix DESC
        `).bind(startOfDay, endOfDay).all();

        const todayStr = vnNow.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

        if (orders.length === 0) {
            await sendTelegramMessage(chatId, `📅 <b>HÔM NAY (${todayStr})</b>\n\n📦 Chưa có đơn hàng nào`, env);
            return;
        }

        // Tính tổng doanh thu
        const totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

        let message = `📊 <b>ĐƠN HÀNG HÔM NAY (${todayStr})</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `📦 Tổng: <b>${orders.length} đơn hàng</b>\n`;
        message += `💰 Doanh thu: <b>${totalRevenue.toLocaleString('vi-VN')}đ</b>\n\n`;
        message += `📋 <b>DANH SÁCH:</b>\n`;

        orders.slice(0, 10).forEach((order, index) => {
            const paymentMethod = order.payment_method === 'cod' ? 'COD' : 'CK';
            message += `${index + 1}. <code>${order.order_id}</code> - ${order.customer_name}\n`;
            message += `   💰 ${order.total_amount.toLocaleString('vi-VN')}đ - ${paymentMethod}\n\n`;
        });

        if (orders.length > 10) {
            message += `... và ${orders.length - 10} đơn hàng khác\n\n`;
        }

        message += `💡 Gõ <code>/find [mã đơn]</code> để xem chi tiết`;

        await sendTelegramMessage(chatId, message, env);

    } catch (error) {
        console.error('❌ Error in sendTodayOrders:', error);
        await sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`, env);
    }
}

/**
 * Gửi thống kê tổng quan
 */
async function sendStatistics(chatId, env) {
    try {
        const vnNow = getVNTime();
        const startOfDay = getVNStartOfDay(vnNow);
        const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

        // Query today's orders
        const { results: todayOrders } = await env.DB.prepare(`
            SELECT total_amount FROM orders 
            WHERE created_at_unix >= ? AND created_at_unix < ?
        `).bind(startOfDay, endOfDay).all();

        // Query all orders
        const { results: allOrders } = await env.DB.prepare(`
            SELECT total_amount FROM orders
        `).all();

        const todayCount = todayOrders.length;
        const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        const totalCount = allOrders.length;
        const totalRevenue = allOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        const avgRevenue = totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0;

        const todayStr = vnNow.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

        let message = `📊 <b>THỐNG KÊ TỔNG QUAN</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `📅 <b>HÔM NAY (${todayStr}):</b>\n`;
        message += `📦 Đơn hàng: <b>${todayCount}</b>\n`;
        message += `💰 Doanh thu: <b>${todayRevenue.toLocaleString('vi-VN')}đ</b>\n\n`;
        message += `📈 <b>TỔNG CỘNG:</b>\n`;
        message += `📦 Tổng đơn hàng: <b>${totalCount}</b>\n`;
        message += `💰 Tổng doanh thu: <b>${totalRevenue.toLocaleString('vi-VN')}đ</b>\n\n`;
        message += `📊 Trung bình: <b>${avgRevenue.toLocaleString('vi-VN')}đ</b>/đơn`;

        await sendTelegramMessage(chatId, message, env);

    } catch (error) {
        console.error('❌ Error in sendStatistics:', error);
        await sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`, env);
    }
}

/**
 * Thống kê tuần này
 */
async function sendWeeklyStats(chatId, env) {
    try {
        const vnNow = getVNTime();
        const startOfWeek = getVNStartOfWeek(vnNow);

        const { results: orders } = await env.DB.prepare(`
            SELECT total_amount FROM orders 
            WHERE created_at_unix >= ?
        `).bind(startOfWeek).all();

        if (orders.length === 0) {
            await sendTelegramMessage(chatId, `📅 <b>TUẦN NÀY</b>\n\n📦 Chưa có đơn hàng nào`, env);
            return;
        }

        const totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        const avgRevenue = Math.round(totalRevenue / orders.length);

        const startDate = new Date(startOfWeek + VN_OFFSET_MS);
        const startStr = startDate.toLocaleDateString('vi-VN');
        const endStr = vnNow.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

        let message = `📊 <b>THỐNG KÊ TUẦN NÀY (${startStr} - ${endStr})</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `📦 Tổng đơn hàng: <b>${orders.length}</b>\n`;
        message += `💰 Doanh thu: <b>${totalRevenue.toLocaleString('vi-VN')}đ</b>\n`;
        message += `📊 Trung bình: <b>${avgRevenue.toLocaleString('vi-VN')}đ</b>/đơn\n\n`;
        message += `💡 Gõ <code>/today</code> để xem chi tiết hôm nay`;

        await sendTelegramMessage(chatId, message, env);

    } catch (error) {
        console.error('❌ Error in sendWeeklyStats:', error);
        await sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`, env);
    }
}

/**
 * Thống kê tháng này
 */
async function sendMonthlyStats(chatId, env) {
    try {
        const vnNow = getVNTime();
        const startOfMonth = getVNStartOfMonth(vnNow);

        const { results: orders } = await env.DB.prepare(`
            SELECT total_amount FROM orders 
            WHERE created_at_unix >= ?
        `).bind(startOfMonth).all();

        if (orders.length === 0) {
            const monthStr = `${vnNow.getUTCMonth() + 1}/${vnNow.getUTCFullYear()}`;
            await sendTelegramMessage(chatId, `📅 <b>THÁNG ${monthStr}</b>\n\n📦 Chưa có đơn hàng nào`, env);
            return;
        }

        const totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        const avgRevenue = Math.round(totalRevenue / orders.length);

        const monthStr = `${vnNow.getUTCMonth() + 1}/${vnNow.getUTCFullYear()}`;

        let message = `📊 <b>THỐNG KÊ THÁNG ${monthStr}</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `📦 Tổng đơn hàng: <b>${orders.length}</b>\n`;
        message += `💰 Doanh thu: <b>${totalRevenue.toLocaleString('vi-VN')}đ</b>\n`;
        message += `📊 Trung bình: <b>${avgRevenue.toLocaleString('vi-VN')}đ</b>/đơn\n\n`;
        message += `💡 Gõ <code>/week</code> để xem thống kê tuần`;

        await sendTelegramMessage(chatId, message, env);

    } catch (error) {
        console.error('❌ Error in sendMonthlyStats:', error);
        await sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`, env);
    }
}

/**
 * Xem đơn hàng gần đây
 */
async function sendRecentOrders(chatId, env) {
    try {
        const { results: orders } = await env.DB.prepare(`
            SELECT order_id, customer_name, customer_phone, total_amount, created_at_unix
            FROM orders 
            ORDER BY created_at_unix DESC 
            LIMIT 10
        `).all();

        if (orders.length === 0) {
            await sendTelegramMessage(chatId, "📦 Chưa có đơn hàng nào", env);
            return;
        }

        let message = `📋 <b>10 ĐƠN HÀNG GẦN NHẤT</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        orders.forEach((order, index) => {
            const orderDate = new Date(order.created_at_unix);
            const dateStr = orderDate.toLocaleString('vi-VN', { 
                day: '2-digit', 
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            message += `${index + 1}. <code>${order.order_id}</code>\n`;
            message += `   👤 ${order.customer_name} - 📞 ${order.customer_phone}\n`;
            message += `   💰 ${order.total_amount.toLocaleString('vi-VN')}đ - 📅 ${dateStr}\n\n`;
        });

        message += `💡 Gõ <code>/find [mã đơn]</code> để xem chi tiết`;
        await sendTelegramMessage(chatId, message, env);

    } catch (error) {
        console.error('❌ Error in sendRecentOrders:', error);
        await sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`, env);
    }
}

/**
 * Tìm đơn hàng cụ thể
 */
async function findOrder(chatId, orderId, env) {
    try {
        const order = await env.DB.prepare(`
            SELECT * FROM orders WHERE order_id = ?
        `).bind(orderId).first();

        if (!order) {
            await sendTelegramMessage(chatId, `❌ Không tìm thấy đơn hàng <code>${orderId}</code>`, env);
            return;
        }

        const orderDate = new Date(order.created_at_unix);
        const dateStr = orderDate.toLocaleString('vi-VN');

        let message = `🔍 <b>CHI TIẾT ĐƠN HÀNG ${order.order_id}</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `👤 <b>${order.customer_name}</b> - <code>${order.customer_phone}</code>\n`;
        message += `📍 ${order.address}\n`;
        message += `💰 <b>Tổng: ${order.total_amount.toLocaleString('vi-VN')}đ</b>\n`;
        
        const paymentMethod = order.payment_method === 'cod' ? 'COD' : 'Chuyển khoản';
        message += `💳 ${paymentMethod}\n`;
        message += `📅 ${dateStr}\n\n`;

        // Parse products
        try {
            const products = JSON.parse(order.products);
            message += `🛍️ <b>SẢN PHẨM:</b>\n`;
            products.forEach((item, index) => {
                message += `${index + 1}. ${item.name} x${item.quantity}\n`;
            });
        } catch (e) {
            message += `🛍️ <b>SẢN PHẨM:</b> ${order.products}\n`;
        }

        if (order.notes) {
            message += `\n💬 <b>Ghi chú:</b> <i>${order.notes}</i>\n`;
        }

        message += `\n🔧 <b>HÀNH ĐỘNG:</b>\n`;
        message += `/customer ${order.customer_phone} - Xem lịch sử khách này`;

        await sendTelegramMessage(chatId, message, env);

    } catch (error) {
        console.error('❌ Error in findOrder:', error);
        await sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`, env);
    }
}

/**
 * Xem lịch sử khách hàng
 */
async function findCustomerHistory(chatId, phone, env) {
    try {
        const { results: orders } = await env.DB.prepare(`
            SELECT order_id, total_amount, created_at_unix
            FROM orders 
            WHERE customer_phone LIKE ?
            ORDER BY created_at_unix DESC
        `).bind(`%${phone}%`).all();

        if (orders.length === 0) {
            await sendTelegramMessage(chatId, `❌ Không tìm thấy đơn hàng nào của SĐT <code>${phone}</code>`, env);
            return;
        }

        const totalSpent = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

        // Get customer name from first order
        const firstOrder = await env.DB.prepare(`
            SELECT customer_name FROM orders WHERE customer_phone LIKE ? LIMIT 1
        `).bind(`%${phone}%`).first();

        let message = `👤 <b>LỊCH SỬ KHÁCH HÀNG</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `📞 SĐT: <code>${phone}</code>\n`;
        message += `👤 Tên: <b>${firstOrder?.customer_name || 'N/A'}</b>\n`;
        message += `📦 Tổng đơn hàng: <b>${orders.length}</b>\n`;
        message += `💰 Tổng chi tiêu: <b>${totalSpent.toLocaleString('vi-VN')}đ</b>\n\n`;
        message += `📋 <b>DANH SÁCH ĐƠN HÀNG:</b>\n`;

        orders.slice(0, 5).forEach((order, index) => {
            const orderDate = new Date(order.created_at_unix);
            const dateStr = orderDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            message += `${index + 1}. <code>${order.order_id}</code> - ${order.total_amount.toLocaleString('vi-VN')}đ (${dateStr})\n`;
        });

        if (orders.length > 5) {
            message += `... và ${orders.length - 5} đơn hàng khác\n`;
        }

        if (orders.length >= 3) {
            message += `\n🌟 <b>KHÁCH HÀNG VIP</b> - Đã mua ${orders.length} lần!`;
        }

        await sendTelegramMessage(chatId, message, env);

    } catch (error) {
        console.error('❌ Error in findCustomerHistory:', error);
        await sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`, env);
    }
}

/**
 * Xem doanh thu hôm qua
 */
async function sendYesterdayRevenue(chatId, env) {
    try {
        const startOfYesterday = getVNStartOfDayOffset(1);
        const endOfYesterday = startOfYesterday + 24 * 60 * 60 * 1000;

        const { results: orders } = await env.DB.prepare(`
            SELECT total_amount FROM orders 
            WHERE created_at_unix >= ? AND created_at_unix < ?
        `).bind(startOfYesterday, endOfYesterday).all();

        const revenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        const yesterdayDate = new Date(startOfYesterday + VN_OFFSET_MS);
        const dateStr = yesterdayDate.toLocaleDateString('vi-VN');

        let message = `💰 <b>DOANH THU HÔM QUA (${dateStr})</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `📦 Đơn hàng: <b>${orders.length}</b>\n`;
        message += `💰 Doanh thu: <b>${revenue.toLocaleString('vi-VN')}đ</b>\n`;
        
        if (orders.length > 0) {
            const avgRevenue = Math.round(revenue / orders.length);
            message += `📊 Trung bình: <b>${avgRevenue.toLocaleString('vi-VN')}đ</b>/đơn`;
        }

        await sendTelegramMessage(chatId, message, env);

    } catch (error) {
        console.error('❌ Error in sendYesterdayRevenue:', error);
        await sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`, env);
    }
}

/**
 * Xem doanh thu 7 ngày qua
 */
async function sendLast7DaysRevenue(chatId, env) {
    try {
        const startOf7Days = getVNStartOfDayOffset(6); // 6 days ago + today = 7 days

        const { results: orders } = await env.DB.prepare(`
            SELECT total_amount, created_at_unix FROM orders 
            WHERE created_at_unix >= ?
            ORDER BY created_at_unix DESC
        `).bind(startOf7Days).all();

        const revenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

        let message = `💰 <b>DOANH THU 7 NGÀY QUA</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `📦 Tổng đơn hàng: <b>${orders.length}</b>\n`;
        message += `💰 Tổng doanh thu: <b>${revenue.toLocaleString('vi-VN')}đ</b>\n`;
        
        if (orders.length > 0) {
            const avgRevenue = Math.round(revenue / orders.length);
            const avgPerDay = Math.round(revenue / 7);
            message += `📊 TB/đơn: <b>${avgRevenue.toLocaleString('vi-VN')}đ</b>\n`;
            message += `📊 TB/ngày: <b>${avgPerDay.toLocaleString('vi-VN')}đ</b>`;
        }

        await sendTelegramMessage(chatId, message, env);

    } catch (error) {
        console.error('❌ Error in sendLast7DaysRevenue:', error);
        await sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`, env);
    }
}

/**
 * Xem doanh thu 30 ngày qua
 */
async function sendLast30DaysRevenue(chatId, env) {
    try {
        const startOf30Days = getVNStartOfDayOffset(29); // 29 days ago + today = 30 days

        const { results: orders } = await env.DB.prepare(`
            SELECT total_amount, created_at_unix FROM orders 
            WHERE created_at_unix >= ?
            ORDER BY created_at_unix DESC
        `).bind(startOf30Days).all();

        const revenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

        let message = `💰 <b>DOANH THU 30 NGÀY QUA</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `📦 Tổng đơn hàng: <b>${orders.length}</b>\n`;
        message += `💰 Tổng doanh thu: <b>${revenue.toLocaleString('vi-VN')}đ</b>\n`;
        
        if (orders.length > 0) {
            const avgRevenue = Math.round(revenue / orders.length);
            const avgPerDay = Math.round(revenue / 30);
            message += `📊 TB/đơn: <b>${avgRevenue.toLocaleString('vi-VN')}đ</b>\n`;
            message += `📊 TB/ngày: <b>${avgPerDay.toLocaleString('vi-VN')}đ</b>`;
        }

        await sendTelegramMessage(chatId, message, env);

    } catch (error) {
        console.error('❌ Error in sendLast30DaysRevenue:', error);
        await sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`, env);
    }
}

/**
 * Tổng quan doanh thu nhanh
 */
async function sendRevenueQuickView(chatId, env) {
    try {
        const vnNow = getVNTime();
        
        // Today
        const startOfToday = getVNStartOfDay(vnNow);
        
        // Yesterday
        const startOfYesterday = getVNStartOfDayOffset(1);
        
        // This month
        const startOfMonth = getVNStartOfMonth(vnNow);

        // Query all periods
        const [todayOrders, yesterdayOrders, monthOrders] = await Promise.all([
            env.DB.prepare(`SELECT total_amount FROM orders WHERE created_at_unix >= ?`).bind(startOfToday).all(),
            env.DB.prepare(`SELECT total_amount FROM orders WHERE created_at_unix >= ? AND created_at_unix < ?`).bind(startOfYesterday, startOfToday).all(),
            env.DB.prepare(`SELECT total_amount FROM orders WHERE created_at_unix >= ?`).bind(startOfMonth).all()
        ]);

        const todayRevenue = todayOrders.results.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        const yesterdayRevenue = yesterdayOrders.results.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        const monthRevenue = monthOrders.results.reduce((sum, o) => sum + (o.total_amount || 0), 0);

        const todayStr = vnNow.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
        const monthStr = `${vnNow.getUTCMonth() + 1}/${vnNow.getUTCFullYear()}`;

        let message = `💰 <b>TỔNG QUAN DOANH THU</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        message += `📅 <b>HÔM NAY (${todayStr}):</b>\n`;
        message += `💰 ${todayRevenue.toLocaleString('vi-VN')}đ (${todayOrders.results.length} đơn)\n\n`;
        
        message += `📅 <b>HÔM QUA:</b>\n`;
        message += `💰 ${yesterdayRevenue.toLocaleString('vi-VN')}đ (${yesterdayOrders.results.length} đơn)\n\n`;
        
        message += `📅 <b>THÁNG NÀY (${monthStr}):</b>\n`;
        message += `💰 ${monthRevenue.toLocaleString('vi-VN')}đ (${monthOrders.results.length} đơn)\n\n`;
        
        // Compare today vs yesterday
        if (yesterdayRevenue > 0) {
            const change = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100).toFixed(1);
            const icon = change >= 0 ? '📈' : '📉';
            message += `${icon} So với hôm qua: ${change > 0 ? '+' : ''}${change}%`;
        }

        await sendTelegramMessage(chatId, message, env);

    } catch (error) {
        console.error('❌ Error in sendRevenueQuickView:', error);
        await sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`, env);
    }
}

/**
 * Gửi tin nhắn Telegram
 */
async function sendTelegramMessage(chatId, message, env) {
    try {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });
    } catch (error) {
        console.error('❌ Error sending Telegram message:', error);
    }
}
