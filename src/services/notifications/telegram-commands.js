/**
 * Telegram Bot Commands Handler
 * Xử lý các lệnh admin từ Telegram
 */

import { sendDailyReport } from './daily-report.js';

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
        console.log('📨 Webhook received:', JSON.stringify(update).substring(0, 200));
        
        // Handle callback query (button clicks)
        if (update.callback_query) {
            console.log('🔘 Callback query:', update.callback_query.data);
            return await handleCallbackQuery(update.callback_query, env);
        }

        if (!update.message) {
            return new Response('OK', { status: 200 });
        }

        const chatId = update.message.chat.id;
        const text = update.message.text;
        const from = update.message.from;

        console.log('💬 Message from:', chatId, 'text:', text);

        // Bỏ qua tin nhắn từ bot
        if (from.is_bot) {
            return new Response('OK', { status: 200 });
        }

        // Tự động nhận diện mã CTV (bắt đầu bằng CTV)
        const ctvRegex = /^CTV\d{6}$/i;
        if (text && ctvRegex.test(text.trim())) {
            console.log('� Auto-detect CTV code:', text);
            await findCTVInfo(chatId, text.trim().toUpperCase(), env);
            return new Response('OK', { status: 200 });
        }

        // Tự động nhận diện số điện thoại (10 số bắt đầu bằng 0)
        const phoneRegex = /^0\d{9}$/;
        if (text && phoneRegex.test(text.trim())) {
            console.log('📞 Auto-detect phone number:', text);
            // Tìm cả khách hàng và CTV
            await findByPhone(chatId, text.trim(), env);
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
 * Xử lý callback query từ inline buttons
 */
async function handleCallbackQuery(callbackQuery, env) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const messageId = callbackQuery.message.message_id;

    try {
        // Answer callback query ngay để tắt loading
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                callback_query_id: callbackQuery.id
            })
        });

        // Xử lý theo data
        switch (data) {
            case 'main_menu':
                await showMainMenu(chatId, messageId, env);
                break;
            case 'menu_revenue':
                await showRevenueMenu(chatId, messageId, env);
                break;
            case 'menu_orders':
                await showOrdersMenu(chatId, messageId, env);
                break;
            case 'menu_ctv':
                await showCTVMenu(chatId, messageId, env);
                break;
            case 'menu_search':
                await showSearchMenu(chatId, messageId, env);
                break;
            case 'menu_back':
                await showMainMenu(chatId, messageId, env);
                break;
            case 'revenue_today':
                await sendTodayOrders(chatId, env);
                break;
            case 'revenue_yesterday':
                await sendYesterdayRevenue(chatId, env);
                break;
            case 'revenue_week':
                await sendWeeklyStats(chatId, env);
                break;
            case 'revenue_month':
                await sendMonthlyStats(chatId, env);
                break;
            case 'revenue_7days':
                await sendLast7DaysRevenue(chatId, env);
                break;
            case 'revenue_30days':
                await sendLast30DaysRevenue(chatId, env);
                break;
            case 'revenue_overview':
                await sendRevenueQuickView(chatId, env);
                break;
            case 'orders_today':
                await sendTodayOrders(chatId, env);
                break;
            case 'orders_recent':
                await sendRecentOrders(chatId, env);
                break;
            case 'orders_stats':
                await sendStatistics(chatId, env);
                break;
            // CTV Menu callbacks
            case 'ctv_overview':
                await sendCTVOverview(chatId, env);
                break;
            case 'ctv_top':
                await sendTopCTV(chatId, env);
                break;
            case 'ctv_new':
                await sendNewCTV(chatId, env);
                break;
            case 'ctv_inactive':
                await sendInactiveCTV(chatId, env);
                break;
            case 'ctv_commission':
                await sendCTVCommission(chatId, env);
                break;
            case 'ctv_search':
                await showCTVSearchMenu(chatId, messageId, env);
                break;
            case 'ctv_back':
                await showCTVMenu(chatId, messageId, env);
                break;
            default:
                // Handle dynamic callbacks like view_ctv_CTV100004
                if (data.startsWith('view_ctv_')) {
                    const ctvCode = data.replace('view_ctv_', '');
                    await findCTVInfo(chatId, ctvCode, env);
                } else if (data.startsWith('view_customer_')) {
                    const phone = data.replace('view_customer_', '');
                    await findCustomerHistory(chatId, phone, env);
                } else if (data.startsWith('view_order_')) {
                    const orderId = data.replace('view_order_', '');
                    await findOrder(chatId, orderId, env);
                } else if (data === 'customer_vip_info') {
                    await sendTelegramMessage(chatId, "🌟 <b>KHÁCH HÀNG VIP</b>\n\nKhách hàng này đã mua từ 3 đơn hàng trở lên!\n\n💡 Nên chăm sóc đặc biệt và ưu đãi để giữ chân khách hàng.", env);
                } else {
                    await sendTelegramMessage(chatId, "❌ Lệnh không hợp lệ", env);
                }
        }
    } catch (error) {
        console.error('❌ Error handling callback:', error);
        // Answer callback với error message
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                callback_query_id: callbackQuery.id,
                text: '❌ Có lỗi xảy ra',
                show_alert: true
            })
        });
    }

    return new Response('OK', { status: 200 });
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

            case '/menu':
                await showMainMenu(chatId, null, env);
                break;

            // Shortcuts - Thống kê nhanh ⭐⭐⭐
            case '/t':
            case '/today':
                await sendTodayOrders(chatId, env);
                break;

            case '/y':
            case '/yesterday':
                await sendYesterdayRevenue(chatId, env);
                break;

            case '/w':
            case '/week':
                await sendWeeklyStats(chatId, env);
                break;

            case '/m':
            case '/month':
                await sendMonthlyStats(chatId, env);
                break;

            case '/stats':
                await sendStatistics(chatId, env);
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

            case '/phone':
                if (parts[1]) {
                    await findCustomerHistory(chatId, parts[1], env);
                } else {
                    await sendTelegramMessage(chatId, "❌ Vui lòng nhập số điện thoại\nVí dụ: /phone 0123456789", env);
                }
                break;

            case '/report':
                await sendManualDailyReport(chatId, env);
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

⭐⭐⭐ <b>THỐNG KÊ NHANH (SHORTCUTS):</b>
/t - Hôm nay
/y - Hôm qua
/w - Tuần này
/m - Tháng này

📱 <b>MENU NHANH:</b>
/menu - Mở menu với buttons

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
/phone 0123456789 - Tìm theo SĐT

📊 <b>BÁO CÁO:</b>
/report - Báo cáo cuối ngày (test)

💡 <b>MẸO:</b> 
• Dùng /menu để truy cập nhanh bằng buttons
• Gõ số điện thoại trực tiếp (10 số) để tìm khách hàng
• Dùng shortcuts /t /y /w /m để xem thống kê nhanh nhất!
    `;

    await sendTelegramMessage(chatId, helpText, env);
}

/**
 * Hiển thị menu chính
 */
async function showMainMenu(chatId, messageId, env) {
    const text = `
🏪 <b>MENU QUẢN LÝ SHOP</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Chọn chức năng bên dưới:
    `;

    const keyboard = {
        inline_keyboard: [
            [
                { text: '💰 Doanh Thu', callback_data: 'menu_revenue' },
                { text: '📦 Đơn Hàng', callback_data: 'menu_orders' }
            ],
            [
                { text: '� CTV', callback_data: 'menu_ctv' },
                { text: '🔍 Tìm Kiếm', callback_data: 'menu_search' }
            ]
        ]
    };

    if (messageId) {
        // Edit existing message
        await editTelegramMessage(chatId, messageId, text, keyboard, env);
    } else {
        // Send new message
        await sendTelegramMessageWithKeyboard(chatId, text, keyboard, env);
    }
}

/**
 * Hiển thị menu doanh thu
 */
async function showRevenueMenu(chatId, messageId, env) {
    const text = `
💰 <b>MENU DOANH THU</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Chọn khoảng thời gian:
    `;

    const keyboard = {
        inline_keyboard: [
            [
                { text: '📊 Tổng Quan', callback_data: 'revenue_overview' }
            ],
            [
                { text: '📅 Hôm Nay', callback_data: 'revenue_today' },
                { text: '📅 Hôm Qua', callback_data: 'revenue_yesterday' }
            ],
            [
                { text: '📆 7 Ngày', callback_data: 'revenue_7days' },
                { text: '📆 30 Ngày', callback_data: 'revenue_30days' }
            ],
            [
                { text: '📈 Tuần Này', callback_data: 'revenue_week' },
                { text: '📈 Tháng Này', callback_data: 'revenue_month' }
            ],
            [
                { text: '◀️ Quay Lại', callback_data: 'menu_back' }
            ]
        ]
    };

    await editTelegramMessage(chatId, messageId, text, keyboard, env);
}

/**
 * Hiển thị menu đơn hàng
 */
async function showOrdersMenu(chatId, messageId, env) {
    const text = `
📦 <b>MENU ĐƠN HÀNG</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Chọn chức năng:
    `;

    const keyboard = {
        inline_keyboard: [
            [
                { text: '📅 Hôm Nay', callback_data: 'orders_today' }
            ],
            [
                { text: '📋 10 Đơn Gần Nhất', callback_data: 'orders_recent' }
            ],
            [
                { text: '📊 Thống Kê', callback_data: 'orders_stats' }
            ],
            [
                { text: '◀️ Quay Lại', callback_data: 'menu_back' }
            ]
        ]
    };

    await editTelegramMessage(chatId, messageId, text, keyboard, env);
}

/**
 * Hiển thị menu tìm kiếm
 */
async function showSearchMenu(chatId, messageId, env) {
    const text = `
🔍 <b>MENU TÌM KIẾM</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>Tìm đơn hàng:</b>
<code>/find VDT001</code>

<b>Tìm khách hàng:</b>
Gõ số điện thoại trực tiếp:
<code>0123456789</code>

Hoặc dùng lệnh:
<code>/customer 0123456789</code>
<code>/phone 0123456789</code>

💡 <b>Mẹo:</b> Chỉ cần gõ số điện thoại (10 số) là bot tự động tìm!
    `;

    const keyboard = {
        inline_keyboard: [
            [
                { text: '◀️ Quay Lại', callback_data: 'menu_back' }
            ]
        ]
    };

    await editTelegramMessage(chatId, messageId, text, keyboard, env);
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

        // Add action buttons
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📦 Đơn Gần Nhất', callback_data: 'orders_recent' },
                    { text: '📊 Thống Kê', callback_data: 'orders_stats' }
                ],
                [
                    { text: '💰 Doanh Thu Hôm Qua', callback_data: 'revenue_yesterday' }
                ]
            ]
        };

        await sendTelegramMessageWithKeyboard(chatId, message, keyboard, env);

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

        // Add navigation buttons
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📅 Hôm Nay', callback_data: 'orders_today' },
                    { text: '📅 Hôm Qua', callback_data: 'revenue_yesterday' }
                ],
                [
                    { text: '📆 Tuần Này', callback_data: 'revenue_week' },
                    { text: '📆 Tháng Này', callback_data: 'revenue_month' }
                ],
                [
                    { text: '📦 Đơn Gần Nhất', callback_data: 'orders_recent' }
                ]
            ]
        };

        await sendTelegramMessageWithKeyboard(chatId, message, keyboard, env);

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

        // Add comparison buttons
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📅 Hôm Nay', callback_data: 'orders_today' },
                    { text: '📆 Tháng Này', callback_data: 'revenue_month' }
                ],
                [
                    { text: '📊 Thống Kê', callback_data: 'orders_stats' }
                ]
            ]
        };

        await sendTelegramMessageWithKeyboard(chatId, message, keyboard, env);

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

        // Add comparison buttons
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📅 Hôm Nay', callback_data: 'orders_today' },
                    { text: '📆 Tuần Này', callback_data: 'revenue_week' }
                ],
                [
                    { text: '📊 Thống Kê', callback_data: 'orders_stats' }
                ]
            ]
        };

        await sendTelegramMessageWithKeyboard(chatId, message, keyboard, env);

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

        // Add quick action buttons
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🔍 Xem Đơn #1', callback_data: 'view_order_' + orders[0].order_id },
                    { text: '🔍 Xem Đơn #2', callback_data: 'view_order_' + orders[1].order_id }
                ],
                [
                    { text: '📊 Thống Kê', callback_data: 'orders_stats' },
                    { text: '📅 Hôm Nay', callback_data: 'orders_today' }
                ]
            ]
        };

        await sendTelegramMessageWithKeyboard(chatId, message, keyboard, env);

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

        if (order.referral_code) {
            message += `\n👥 <b>CTV:</b> <code>${order.referral_code}</code>\n`;
        }

        // Add action buttons (không dùng tel: vì Telegram không hỗ trợ)
        const keyboard = {
            inline_keyboard: []
        };

        // Add CTV button if order has referral code
        if (order.referral_code) {
            keyboard.inline_keyboard.push([
                { text: '👤 Xem CTV', callback_data: 'view_ctv_' + order.referral_code }
            ]);
        }

        // Add customer history button
        keyboard.inline_keyboard.push([
            { text: '📋 Lịch Sử Khách', callback_data: 'view_customer_' + order.customer_phone }
        ]);

        await sendTelegramMessageWithKeyboard(chatId, message, keyboard, env);

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

        // Check if customer is VIP (3+ orders)
        const isVIP = orders.length >= 3;

        let message = `👤 <b>LỊCH SỬ KHÁCH HÀNG</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `📞 SĐT: <code>${phone}</code>\n`;
        message += `👤 Tên: <b>${firstOrder?.customer_name || 'N/A'}</b>\n`;
        message += `📦 Tổng đơn hàng: <b>${orders.length}</b>\n`;
        message += `💰 Tổng chi tiêu: <b>${totalSpent.toLocaleString('vi-VN')}đ</b>\n`;
        
        if (isVIP) {
            message += `\n🌟 <b>KHÁCH HÀNG VIP</b> - Đã mua ${orders.length} lần!\n`;
        }
        
        message += `\n📋 <b>DANH SÁCH ĐƠN HÀNG:</b>\n`;

        orders.slice(0, 5).forEach((order, index) => {
            const orderDate = new Date(order.created_at_unix);
            const dateStr = orderDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            message += `${index + 1}. <code>${order.order_id}</code> - ${order.total_amount.toLocaleString('vi-VN')}đ (${dateStr})\n`;
        });

        if (orders.length > 5) {
            message += `... và ${orders.length - 5} đơn hàng khác\n`;
        }

        // Add action buttons (không dùng tel: và sms: vì Telegram không hỗ trợ)
        const keyboard = {
            inline_keyboard: []
        };

        // Add view order buttons if there are orders
        if (orders.length >= 2) {
            keyboard.inline_keyboard.push([
                { text: '� Xem Đơn #1', callback_data: 'view_order_' + orders[0].order_id },
                { text: '🔍 Xem Đơn #2', callback_data: 'view_order_' + orders[1].order_id }
            ]);
        } else if (orders.length === 1) {
            keyboard.inline_keyboard.push([
                { text: '🔍 Xem Đơn #1', callback_data: 'view_order_' + orders[0].order_id }
            ]);
        }

        // Add VIP badge button if applicable
        if (isVIP) {
            keyboard.inline_keyboard.push([
                { text: '🌟 Khách VIP', callback_data: 'customer_vip_info' }
            ]);
        }

        await sendTelegramMessageWithKeyboard(chatId, message, keyboard, env);

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
 * Gửi tin nhắn Telegram với Menu button
 */
async function sendTelegramMessage(chatId, message, env) {
    try {
        // Tự động thêm Menu button cho mọi tin nhắn
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
        console.error('❌ Error sending Telegram message:', error);
    }
}

/**
 * Thêm Menu button vào keyboard
 */
function addMenuButton(keyboard) {
    if (!keyboard.inline_keyboard) {
        keyboard.inline_keyboard = [];
    }
    
    // Thêm Menu button ở cuối
    keyboard.inline_keyboard.push([
        { text: '🏠 Menu', callback_data: 'main_menu' }
    ]);
    
    return keyboard;
}

/**
 * Gửi tin nhắn với inline keyboard
 */
async function sendTelegramMessageWithKeyboard(chatId, message, keyboard, env) {
    try {
        console.log('📤 Sending message with keyboard to:', chatId);
        console.log('📝 Message length:', message.length);
        
        // Tự động thêm Menu button vào mọi keyboard
        const keyboardWithMenu = addMenuButton(keyboard);
        console.log('⌨️ Keyboard:', JSON.stringify(keyboardWithMenu));
        
        const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
                reply_markup: keyboardWithMenu,
                disable_web_page_preview: true
            })
        });
        
        const result = await response.json();
        console.log('✅ Telegram API response:', result.ok ? 'Success' : 'Failed');
        if (!result.ok) {
            console.error('❌ Telegram API error:', result);
        }
        
        return result;
    } catch (error) {
        console.error('❌ Error sending message with keyboard:', error);
        throw error;
    }
}

/**
 * Edit tin nhắn với inline keyboard
 */
async function editTelegramMessage(chatId, messageId, message, keyboard, env) {
    try {
        console.log('✏️ Editing message:', messageId);
        
        // Tự động thêm Menu button vào mọi keyboard
        const keyboardWithMenu = addMenuButton(keyboard);
        
        const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                text: message,
                parse_mode: 'HTML',
                reply_markup: keyboardWithMenu,
                disable_web_page_preview: true
            })
        });
        
        const result = await response.json();
        if (!response.ok) {
            console.error('❌ Edit message error:', result);
        } else {
            console.log('✅ Message edited successfully');
        }
    } catch (error) {
        console.error('❌ Error editing message:', error);
    }
}

/**
 * Gửi báo cáo cuối ngày thủ công (test)
 */
async function sendManualDailyReport(chatId, env) {
    try {
        await sendTelegramMessage(chatId, "⏳ Đang tạo báo cáo...", env);
        await sendDailyReport(env);
    } catch (error) {
        console.error('❌ Error sending manual report:', error);
        await sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`, env);
    }
}

/**
 * ============================================
 * CTV MENU & FUNCTIONS
 * ============================================
 */

/**
 * Hiển thị menu CTV
 */
async function showCTVMenu(chatId, messageId, env) {
    const text = `
👥 <b>QUẢN LÝ CTV</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Chọn chức năng:
    `;

    const keyboard = {
        inline_keyboard: [
            [
                { text: '📊 Tổng Quan', callback_data: 'ctv_overview' }
            ],
            [
                { text: '🏆 Top CTV', callback_data: 'ctv_top' },
                { text: '🆕 CTV Mới', callback_data: 'ctv_new' }
            ],
            [
                { text: '⚠️ Không Hoạt Động', callback_data: 'ctv_inactive' }
            ],
            [
                { text: '💰 Hoa Hồng Tháng Này', callback_data: 'ctv_commission' }
            ],
            [
                { text: '🔍 Tìm CTV', callback_data: 'ctv_search' }
            ],
            [
                { text: '◀️ Quay Lại', callback_data: 'menu_back' }
            ]
        ]
    };

    await editTelegramMessage(chatId, messageId, text, keyboard, env);
}

/**
 * Hiển thị menu tìm kiếm CTV
 */
async function showCTVSearchMenu(chatId, messageId, env) {
    const text = `
🔍 <b>TÌM KIẾM CTV</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>Gõ để tìm kiếm:</b>

📝 <b>Mã CTV:</b>
<code>CTV100004</code>

📞 <b>Số điện thoại:</b>
<code>0901234504</code>

💡 Bot sẽ tự động nhận diện!
    `;

    const keyboard = {
        inline_keyboard: [
            [
                { text: '◀️ Quay Lại Menu CTV', callback_data: 'ctv_back' }
            ]
        ]
    };

    await editTelegramMessage(chatId, messageId, text, keyboard, env);
}

/**
 * Gửi tổng quan CTV
 */
async function sendCTVOverview(chatId, env) {
    try {
        const vnNow = getVNTime();
        const startOfMonth = getVNStartOfMonth(vnNow);

        // Get all CTV
        const { results: allCTV } = await env.DB.prepare(`
            SELECT referral_code, full_name, created_at_unix FROM ctv
        `).all();

        // Get CTV with orders
        const { results: ctvWithOrders } = await env.DB.prepare(`
            SELECT DISTINCT referral_code FROM orders 
            WHERE referral_code IS NOT NULL AND referral_code != ''
        `).all();

        // Get new CTV this month
        const newCTVThisMonth = allCTV.filter(ctv => ctv.created_at_unix >= startOfMonth).length;

        // Get total commission
        const totalCommission = await env.DB.prepare(`
            SELECT SUM(commission) as total FROM orders 
            WHERE referral_code IS NOT NULL AND referral_code != ''
        `).first();

        // Get top 3 CTV
        const { results: topCTV } = await env.DB.prepare(`
            SELECT 
                o.referral_code,
                c.full_name,
                COUNT(*) as order_count,
                SUM(o.total_amount) as total_revenue,
                SUM(o.commission) as total_commission
            FROM orders o
            LEFT JOIN ctv c ON o.referral_code = c.referral_code
            WHERE o.referral_code IS NOT NULL AND o.referral_code != ''
            GROUP BY o.referral_code, c.full_name
            ORDER BY total_revenue DESC
            LIMIT 3
        `).all();

        const activeCTV = ctvWithOrders.length;
        const inactiveCTV = allCTV.length - activeCTV;
        const activePercent = allCTV.length > 0 ? ((activeCTV / allCTV.length) * 100).toFixed(1) : 0;

        let message = `👥 <b>THỐNG KÊ CTV</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        message += `📊 <b>TỔNG QUAN:</b>\n`;
        message += `• Tổng CTV: <b>${allCTV.length}</b>\n`;
        message += `• Đang hoạt động: <b>${activeCTV}</b> (${activePercent}%)\n`;
        message += `• Mới tháng này: <b>${newCTVThisMonth}</b>\n`;
        message += `• Tổng hoa hồng: <b>${(totalCommission.total || 0).toLocaleString('vi-VN')}đ</b>\n\n`;

        if (topCTV.length > 0) {
            message += `🏆 <b>TOP 3 CTV XUẤT SẮC:</b>\n`;
            topCTV.forEach((ctv, index) => {
                message += `${index + 1}. ${ctv.referral_code} - ${ctv.full_name || 'N/A'}\n`;
                message += `   📦 ${ctv.order_count} đơn | 💰 ${ctv.total_revenue.toLocaleString('vi-VN')}đ\n`;
            });
            message += `\n`;
        }

        if (inactiveCTV > 0) {
            message += `⚠️ <b>CTV chưa có đơn:</b> ${inactiveCTV} (${(100 - parseFloat(activePercent)).toFixed(1)}%)\n\n`;
        }

        message += `💡 Gõ mã CTV hoặc SĐT để xem chi tiết`;

        // Add inline buttons
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🏆 Top CTV', callback_data: 'ctv_top' },
                    { text: '🆕 CTV Mới', callback_data: 'ctv_new' }
                ],
                [
                    { text: '💰 Hoa Hồng', callback_data: 'ctv_commission' }
                ]
            ]
        };

        await sendTelegramMessageWithKeyboard(chatId, message, keyboard, env);

    } catch (error) {
        console.error('❌ Error in sendCTVOverview:', error);
        await sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`, env);
    }
}

/**
 * Gửi top CTV
 */
async function sendTopCTV(chatId, env) {
    try {
        const { results: topCTV } = await env.DB.prepare(`
            SELECT 
                o.referral_code,
                c.full_name,
                c.phone,
                COUNT(*) as order_count,
                SUM(o.total_amount) as total_revenue,
                SUM(o.commission) as total_commission
            FROM orders o
            LEFT JOIN ctv c ON o.referral_code = c.referral_code
            WHERE o.referral_code IS NOT NULL AND o.referral_code != ''
            GROUP BY o.referral_code, c.full_name, c.phone
            ORDER BY total_revenue DESC
            LIMIT 10
        `).all();

        if (topCTV.length === 0) {
            await sendTelegramMessage(chatId, "📊 Chưa có CTV nào có đơn hàng", env);
            return;
        }

        let message = `🏆 <b>TOP 10 CTV XUẤT SẮC</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        topCTV.forEach((ctv, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            message += `${medal} <b>${ctv.referral_code}</b>\n`;
            message += `   👤 ${ctv.full_name || 'N/A'} - 📞 ${ctv.phone || 'N/A'}\n`;
            message += `   📦 ${ctv.order_count} đơn | 💰 ${ctv.total_revenue.toLocaleString('vi-VN')}đ\n`;
            message += `   🎁 Hoa hồng: ${ctv.total_commission.toLocaleString('vi-VN')}đ\n\n`;
        });

        message += `💡 Gõ <code>${topCTV[0].referral_code}</code> để xem chi tiết`;

        // Add quick action buttons
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '👤 Xem #1: ' + topCTV[0].referral_code, callback_data: 'view_ctv_' + topCTV[0].referral_code }
                ],
                [
                    { text: '📊 Tổng Quan', callback_data: 'ctv_overview' },
                    { text: '💰 Hoa Hồng', callback_data: 'ctv_commission' }
                ]
            ]
        };

        await sendTelegramMessageWithKeyboard(chatId, message, keyboard, env);

    } catch (error) {
        console.error('❌ Error in sendTopCTV:', error);
        await sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`, env);
    }
}

/**
 * Gửi danh sách CTV mới
 */
async function sendNewCTV(chatId, env) {
    try {
        const vnNow = getVNTime();
        const startOfMonth = getVNStartOfMonth(vnNow);

        const { results: newCTV } = await env.DB.prepare(`
            SELECT 
                c.referral_code,
                c.full_name,
                c.phone,
                c.city,
                c.created_at_unix,
                COUNT(o.id) as order_count
            FROM ctv c
            LEFT JOIN orders o ON c.referral_code = o.referral_code
            WHERE c.created_at_unix >= ?
            GROUP BY c.referral_code, c.full_name, c.phone, c.city, c.created_at_unix
            ORDER BY c.created_at_unix DESC
        `).bind(startOfMonth).all();

        if (newCTV.length === 0) {
            await sendTelegramMessage(chatId, "🆕 Chưa có CTV mới tháng này", env);
            return;
        }

        const monthStr = `${vnNow.getUTCMonth() + 1}/${vnNow.getUTCFullYear()}`;

        let message = `🆕 <b>CTV MỚI THÁNG ${monthStr}</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `📊 Tổng: <b>${newCTV.length} CTV</b>\n\n`;

        newCTV.slice(0, 10).forEach((ctv, index) => {
            const hasOrders = ctv.order_count > 0;
            const status = hasOrders ? '✅' : '⏳';
            const createdDate = new Date(ctv.created_at_unix + VN_OFFSET_MS);
            const dateStr = createdDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

            message += `${index + 1}. ${status} <b>${ctv.referral_code}</b>\n`;
            message += `   👤 ${ctv.full_name} - 📞 ${ctv.phone}\n`;
            message += `   📍 ${ctv.city || 'N/A'} | 📅 ${dateStr}\n`;
            if (hasOrders) {
                message += `   📦 Đã có ${ctv.order_count} đơn hàng\n`;
            }
            message += `\n`;
        });

        if (newCTV.length > 10) {
            message += `... và ${newCTV.length - 10} CTV khác\n\n`;
        }

        const withOrders = newCTV.filter(c => c.order_count > 0).length;
        message += `Đã có đơn: ${withOrders}/${newCTV.length}`;

        await sendTelegramMessage(chatId, message, env);

    } catch (error) {
        console.error('❌ Error in sendNewCTV:', error);
        await sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`, env);
    }
}

/**
 * Gửi danh sách CTV không hoạt động
 */
async function sendInactiveCTV(chatId, env) {
    try {
        const { results: inactiveCTV } = await env.DB.prepare(`
            SELECT 
                c.referral_code,
                c.full_name,
                c.phone,
                c.city,
                c.created_at_unix
            FROM ctv c
            LEFT JOIN orders o ON c.referral_code = o.referral_code
            WHERE o.id IS NULL
            ORDER BY c.created_at_unix DESC
            LIMIT 20
        `).all();

        if (inactiveCTV.length === 0) {
            await sendTelegramMessage(chatId, "✅ Tất cả CTV đều đã có đơn hàng!", env);
            return;
        }

        let message = `⚠️ <b>CTV CHƯA CÓ ĐƠN HÀNG</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `📊 Tổng: <b>${inactiveCTV.length} CTV</b>\n\n`;

        inactiveCTV.slice(0, 15).forEach((ctv, index) => {
            const createdDate = new Date(ctv.created_at_unix + VN_OFFSET_MS);
            const dateStr = createdDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

            message += `${index + 1}. <b>${ctv.referral_code}</b>\n`;
            message += `   👤 ${ctv.full_name} - 📞 ${ctv.phone}\n`;
            message += `   📍 ${ctv.city || 'N/A'} | 📅 Đăng ký: ${dateStr}\n\n`;
        });

        if (inactiveCTV.length > 15) {
            message += `... và ${inactiveCTV.length - 15} CTV khác\n\n`;
        }

        message += `💡 <b>Gợi ý:</b> Liên hệ động viên các CTV này`;

        await sendTelegramMessage(chatId, message, env);

    } catch (error) {
        console.error('❌ Error in sendInactiveCTV:', error);
        await sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`, env);
    }
}

/**
 * Gửi thống kê hoa hồng tháng này
 */
async function sendCTVCommission(chatId, env) {
    try {
        const vnNow = getVNTime();
        const startOfMonth = getVNStartOfMonth(vnNow);

        const { results: commissionData } = await env.DB.prepare(`
            SELECT 
                o.referral_code,
                c.full_name,
                c.phone,
                c.bank_account_number,
                c.bank_name,
                COUNT(*) as order_count,
                SUM(o.total_amount) as total_revenue,
                SUM(o.commission) as total_commission
            FROM orders o
            LEFT JOIN ctv c ON o.referral_code = c.referral_code
            WHERE o.referral_code IS NOT NULL 
              AND o.referral_code != ''
              AND o.created_at_unix >= ?
            GROUP BY o.referral_code, c.full_name, c.phone, c.bank_account_number, c.bank_name
            ORDER BY total_commission DESC
        `).bind(startOfMonth).all();

        if (commissionData.length === 0) {
            const monthStr = `${vnNow.getUTCMonth() + 1}/${vnNow.getUTCFullYear()}`;
            await sendTelegramMessage(chatId, `💰 Chưa có hoa hồng nào tháng ${monthStr}`, env);
            return;
        }

        const totalCommission = commissionData.reduce((sum, c) => sum + c.total_commission, 0);
        const monthStr = `${vnNow.getUTCMonth() + 1}/${vnNow.getUTCFullYear()}`;

        let message = `💰 <b>HOA HỒNG THÁNG ${monthStr}</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `📊 <b>TỔNG QUAN:</b>\n`;
        message += `• Tổng hoa hồng: <b>${totalCommission.toLocaleString('vi-VN')}đ</b>\n`;
        message += `• Số CTV: <b>${commissionData.length}</b>\n\n`;

        message += `📋 <b>CHI TIẾT:</b>\n`;
        commissionData.forEach((ctv, index) => {
            message += `${index + 1}. <b>${ctv.referral_code}</b> - ${ctv.full_name || 'N/A'}\n`;
            message += `   📞 ${ctv.phone || 'N/A'}\n`;
            if (ctv.bank_account_number && ctv.bank_name) {
                message += `   🏦 ${ctv.bank_name} - ${ctv.bank_account_number}\n`;
            }
            message += `   📦 ${ctv.order_count} đơn | 💰 ${ctv.total_revenue.toLocaleString('vi-VN')}đ\n`;
            message += `   🎁 <b>Hoa hồng: ${ctv.total_commission.toLocaleString('vi-VN')}đ</b>\n\n`;
        });

        message += `💡 Dùng thông tin này để thanh toán hoa hồng`;

        await sendTelegramMessage(chatId, message, env);

    } catch (error) {
        console.error('❌ Error in sendCTVCommission:', error);
        await sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`, env);
    }
}

/**
 * Tìm thông tin CTV theo mã
 */
async function findCTVInfo(chatId, ctvCode, env) {
    try {
        // Get CTV info
        const ctv = await env.DB.prepare(`
            SELECT * FROM ctv WHERE referral_code = ?
        `).bind(ctvCode).first();

        if (!ctv) {
            await sendTelegramMessage(chatId, `❌ Không tìm thấy CTV với mã <code>${ctvCode}</code>`, env);
            return;
        }

        // Get order stats
        const orderStats = await env.DB.prepare(`
            SELECT 
                COUNT(*) as total_orders,
                SUM(total_amount) as total_revenue,
                SUM(commission) as total_commission
            FROM orders
            WHERE referral_code = ?
        `).bind(ctvCode).first();

        // Get recent orders
        const { results: recentOrders } = await env.DB.prepare(`
            SELECT 
                order_id,
                customer_name,
                total_amount,
                commission,
                created_at_unix
            FROM orders
            WHERE referral_code = ?
            ORDER BY created_at_unix DESC
            LIMIT 5
        `).bind(ctvCode).all();

        const createdDate = new Date(ctv.created_at_unix + VN_OFFSET_MS);
        const dateStr = createdDate.toLocaleDateString('vi-VN');

        let message = `👤 <b>THÔNG TIN CTV</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        message += `📋 <b>CƠ BẢN:</b>\n`;
        message += `• Tên: <b>${ctv.full_name}</b>\n`;
        message += `• SĐT: <code>${ctv.phone}</code>\n`;
        if (ctv.email) message += `• Email: ${ctv.email}\n`;
        if (ctv.city) message += `• Địa chỉ: ${ctv.city}\n`;
        message += `• Đăng ký: ${dateStr}\n\n`;

        message += `🔗 <b>MÃ GIỚI THIỆU:</b>\n`;
        message += `• Code: <code>${ctv.referral_code}</code>\n`;
        message += `• Link: shopvd.store/?ref=${ctv.referral_code}\n`;
        if (ctv.custom_slug) {
            message += `• Slug: shopvd.store/?ref=${ctv.custom_slug}\n`;
        }
        message += `• Commission: ${(ctv.commission_rate * 100).toFixed(0)}%\n\n`;

        if (ctv.bank_account_number && ctv.bank_name) {
            message += `🏦 <b>NGÂN HÀNG:</b>\n`;
            message += `• ${ctv.bank_name}\n`;
            message += `• STK: <code>${ctv.bank_account_number}</code>\n\n`;
        }

        message += `📊 <b>THỐNG KÊ:</b>\n`;
        message += `• Tổng đơn: <b>${orderStats.total_orders || 0}</b>\n`;
        message += `• Doanh thu: <b>${(orderStats.total_revenue || 0).toLocaleString('vi-VN')}đ</b>\n`;
        message += `• Hoa hồng: <b>${(orderStats.total_commission || 0).toLocaleString('vi-VN')}đ</b>\n`;

        if (recentOrders.length > 0) {
            message += `\n📦 <b>ĐƠN HÀNG GẦN NHẤT:</b>\n`;
            recentOrders.forEach((order, index) => {
                const orderDate = new Date(order.created_at_unix + VN_OFFSET_MS);
                const orderDateStr = orderDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                message += `${index + 1}. <code>${order.order_id}</code> - ${order.total_amount.toLocaleString('vi-VN')}đ (${orderDateStr})\n`;
            });
        }

        // Add inline buttons with actions (không dùng tel: và sms: vì Telegram không hỗ trợ)
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📦 Xem Tất Cả Đơn', url: `https://shopvd.store/admin/?ctv=${ctvCode}` }
                ],
                [
                    { text: '🏆 Top CTV', callback_data: 'ctv_top' },
                    { text: '� Menu CTV', callback_data: 'menu_ctv' }
                ]
            ]
        };

        await sendTelegramMessageWithKeyboard(chatId, message, keyboard, env);

    } catch (error) {
        console.error('❌ Error in findCTVInfo:', error);
        await sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`, env);
    }
}

/**
 * Tìm theo số điện thoại (cả khách hàng và CTV)
 */
async function findByPhone(chatId, phone, env) {
    try {
        console.log('🔍 findByPhone called with:', phone);
        
        // Normalize phone number
        const cleanPhone = phone.trim();
        
        // Tìm CTV trước
        const ctv = await env.DB.prepare(`
            SELECT referral_code, full_name FROM ctv 
            WHERE phone = ? OR phone = ? OR phone = ?
        `).bind(cleanPhone, '0' + cleanPhone, cleanPhone.replace(/^0/, '')).first();

        console.log('👥 CTV search result:', ctv ? 'Found' : 'Not found');

        if (ctv) {
            // Nếu là CTV, hiển thị thông tin CTV
            console.log('Found CTV, showing CTV info');
            await findCTVInfo(chatId, ctv.referral_code, env);
        } else {
            // Nếu không phải CTV, tìm lịch sử khách hàng
            console.log('👤 Not CTV, searching customer history');
            await findCustomerHistory(chatId, cleanPhone, env);
        }

    } catch (error) {
        console.error('❌ Error in findByPhone:', error);
        await sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`, env);
    }
}
