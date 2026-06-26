/**
 * Telegram Notification Service
 * Gửi thông báo đơn hàng mới qua Telegram Bot
 */

import { computeCodCollectAmount, isBankPaymentMethod } from '../orders/order-persist-helpers.js';

/**
 * Dòng HTML Telegram cho cọc / COD thu hộ (rỗng nếu không có cọc hoặc đơn CK).
 */
export function formatTelegramDepositLines({ totalAmount, depositAmount, paymentMethod }) {
    const deposit = Math.max(0, Math.round(Number(depositAmount) || 0));
    if (deposit <= 0) return '';
    if (isBankPaymentMethod(paymentMethod)) return '';
    const total = Math.max(0, Math.round(Number(totalAmount) || 0));
    const cod = computeCodCollectAmount(total, deposit, paymentMethod);
    let lines = `💵 Đã cọc: <b>${deposit.toLocaleString('vi-VN')}đ</b>\n`;
    lines += `📦 Thu COD: <b>${cod.toLocaleString('vi-VN')}đ</b>\n`;
    return lines;
}

/**
 * Gửi thông báo đơn hàng mới qua Telegram
 * @param {Object} orderData - Dữ liệu đơn hàng
 * @param {Object} env - Environment variables
 * @returns {Promise<boolean>} - Success status
 */
export async function sendOrderNotification(orderData, env) {
    try {
        // Kiểm tra config
        if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
            console.warn('⚠️ Telegram config not found, skipping notification');
            return false;
        }

        // Tạo nội dung tin nhắn
        const message = createTelegramMessage(orderData);

        // Tạo inline keyboard với quick actions (không dùng tel: và sms: vì Telegram không hỗ trợ)
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🔍 Xem Chi Tiết', callback_data: 'view_order_' + orderData.orderId }
                ],
                [
                    { text: '📋 Lịch Sử Khách', callback_data: 'view_customer_' + orderData.customer.phone },
                    { text: '📅 Đơn Hôm Nay', callback_data: 'orders_today' }
                ],
                [
                    { text: '🏠 Menu', callback_data: 'main_menu' }
                ]
            ]
        };

        // Add CTV button if order has referral code
        if (orderData.referralCode && orderData.referralCode.trim() !== "") {
            keyboard.inline_keyboard.splice(2, 0, [
                { text: '👤 Xem CTV', callback_data: 'view_ctv_' + orderData.referralCode }
            ]);
        }

        // Gửi tin nhắn qua Telegram API
        const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: env.TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                reply_markup: keyboard
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Telegram API error:', response.status, errorText);
            return false;
        }

        console.log('✅ Telegram notification sent:', orderData.orderId);
        return true;

    } catch (error) {
        console.error('❌ Error sending Telegram notification:', error);
        return false;
    }
}

/**
 * Tạo nội dung tin nhắn Telegram với format đẹp
 * @param {Object} orderData - Dữ liệu đơn hàng
 * @returns {string} - Formatted message
 */
function createTelegramMessage(orderData) {
    // Header
    let message = `🔔 <b>ĐƠN HÀNG MỚI</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Thông tin đơn hàng
    message += `📋 <b>THÔNG TIN ĐƠN HÀNG</b>\n`;
    message += `🆔 Mã đơn: <code>${orderData.orderId}</code>\n`;
    
    // Format thời gian
    const orderDate = new Date(orderData.orderDate || Date.now());
    const dateStr = orderDate.toLocaleString('vi-VN', { 
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    message += `📅 Thời gian: ${dateStr}\n`;
    
    // Format tổng tiền
    const totalAmount = typeof orderData.total === 'string' 
        ? orderData.total 
        : `${orderData.total.toLocaleString('vi-VN')}đ`;
    message += `💰 <b>Tổng tiền: ${totalAmount}</b>\n`;
    
    // Phương thức thanh toán
    const paymentMethod = getPaymentMethodText(orderData.paymentMethod);
    message += `💳 Thanh toán: ${paymentMethod}\n`;

    const depositLines = formatTelegramDepositLines({
        totalAmount: orderData.totalAmount ?? orderData.total_amount ?? orderData.total,
        depositAmount: orderData.depositAmount ?? orderData.deposit_amount,
        paymentMethod: orderData.paymentMethod ?? orderData.payment_method
    });
    if (depositLines) message += depositLines;

    message += `\n`;

    // Thông tin khách hàng
    message += `👤 <b>KHÁCH HÀNG</b>\n`;
    message += `📝 Tên: ${orderData.customer.name}\n`;
    message += `📞 SĐT: <code>${orderData.customer.phone}</code>\n`;
    message += `📍 Địa chỉ: ${orderData.customer.address || orderData.address || 'Chưa có'}\n`;
    
    if (orderData.customer.notes && orderData.customer.notes.trim()) {
        message += `💬 Ghi chú: <i>${orderData.customer.notes.trim()}</i>\n`;
    }
    message += `\n`;

    // Chi tiết sản phẩm
    message += `🛍️ <b>CHI TIẾT SẢN PHẨM</b>\n`;
    if (orderData.cart && orderData.cart.length > 0) {
        orderData.cart.forEach((item, index) => {
            message += `${index + 1}. <b>${item.name}</b>\n`;
            message += `   • SL: ${item.quantity}`;

            if (item.weight && item.weight !== 'Không có') {
                message += ` | Cân nặng: ${item.weight}`;
            }
            message += `\n`;

            if (item.notes && item.notes.trim()) {
                message += `   📝 <i>${item.notes.trim()}</i>\n`;
            }

            if (index < orderData.cart.length - 1) {
                message += `\n`;
            }
        });
    } else {
        message += `Không có sản phẩm\n`;
    }

    // Thông tin referral (nếu có)
    if (orderData.referralCode && orderData.referralCode.trim() !== "") {
        message += `\n🤝 <b>REFERRAL</b>\n`;
        message += `📋 Mã: <code>${orderData.referralCode}</code>\n`;
        
        if (orderData.referralPartner) {
            message += `👤 Partner: ${orderData.referralPartner}\n`;
        }
        
        if (orderData.referralCommission && orderData.referralCommission > 0) {
            message += `💰 Hoa hồng: <b>${orderData.referralCommission.toLocaleString('vi-VN')}đ</b>\n`;
        }
    }

    // Footer
    message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🏪 <i>Vòng Dâu Tằm By Ánh</i>`;

    return message;
}

/**
 * Chuyển đổi payment method thành text dễ đọc
 * @param {string} paymentMethod - Payment method code
 * @returns {string} - Readable text
 */
function getPaymentMethodText(paymentMethod) {
    switch (paymentMethod) {
        case 'cod':
            return "COD (Thanh toán khi nhận)";
        case 'bank':
        case 'bank_transfer':
            return "Chuyển khoản ngân hàng";
        default:
            return paymentMethod || "Không xác định";
    }
}
