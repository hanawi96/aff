/**
 * Script test thông báo Telegram
 * Chạy: node test-telegram-notification.js
 */

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Sample order data
const sampleOrder = {
    orderId: 'VDT-TEST-001',
    orderDate: Date.now(),
    customer: {
        name: 'Nguyễn Văn A',
        phone: '0123456789',
        address: 'Số 123, Đường ABC, Phường XYZ, Quận 1, TP.HCM',
        notes: 'Giao hàng giờ hành chính'
    },
    cart: [
        {
            name: 'Vòng Dâu Tằm Cổ Điển',
            quantity: 2,
            weight: '15-20g',
            notes: 'Màu đỏ'
        },
        {
            name: 'Charm Bạc Hình Trái Tim',
            quantity: 1,
            notes: ''
        }
    ],
    total: '450,000đ',
    paymentMethod: 'cod',
    referralCode: 'ANHIEN2024',
    referralCommission: 45000,
    referralPartner: 'Nguyễn Thị B'
};

// Create Telegram message
function createTelegramMessage(orderData) {
    let message = `🔔 <b>ĐƠN HÀNG MỚI (TEST)</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    message += `📋 <b>THÔNG TIN ĐƠN HÀNG</b>\n`;
    message += `🆔 Mã đơn: <code>${orderData.orderId}</code>\n`;
    
    const orderDate = new Date(orderData.orderDate);
    const dateStr = orderDate.toLocaleString('vi-VN', { 
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    message += `📅 Thời gian: ${dateStr}\n`;
    message += `💰 <b>Tổng tiền: ${orderData.total}</b>\n`;
    
    const paymentMethod = orderData.paymentMethod === 'cod' 
        ? 'COD (Thanh toán khi nhận)' 
        : 'Chuyển khoản ngân hàng';
    message += `💳 Thanh toán: ${paymentMethod}\n\n`;

    message += `👤 <b>KHÁCH HÀNG</b>\n`;
    message += `📝 Tên: ${orderData.customer.name}\n`;
    message += `📞 SĐT: <code>${orderData.customer.phone}</code>\n`;
    message += `📍 Địa chỉ: ${orderData.customer.address}\n`;
    
    if (orderData.customer.notes) {
        message += `💬 Ghi chú: <i>${orderData.customer.notes}</i>\n`;
    }
    message += `\n`;

    message += `🛍️ <b>CHI TIẾT SẢN PHẨM</b>\n`;
    orderData.cart.forEach((item, index) => {
        message += `${index + 1}. <b>${item.name}</b>\n`;
        message += `   • SL: ${item.quantity}`;

        if (item.weight) {
            message += ` | Cân nặng: ${item.weight}`;
        }
        message += `\n`;

        if (item.notes) {
            message += `   📝 <i>${item.notes}</i>\n`;
        }

        if (index < orderData.cart.length - 1) {
            message += `\n`;
        }
    });

    if (orderData.referralCode) {
        message += `\n🤝 <b>REFERRAL</b>\n`;
        message += `📋 Mã: <code>${orderData.referralCode}</code>\n`;
        
        if (orderData.referralPartner) {
            message += `👤 Partner: ${orderData.referralPartner}\n`;
        }
        
        if (orderData.referralCommission) {
            message += `💰 Hoa hồng: <b>${orderData.referralCommission.toLocaleString('vi-VN')}đ</b>\n`;
        }
    }

    message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🏪 <i>Vòng Dâu Tằm By Ánh</i>\n`;
    message += `⚠️ <b>ĐÂY LÀ TIN NHẮN TEST</b>`;

    return message;
}

// Send test notification
async function sendTestNotification() {
    try {
        console.log('🚀 Đang gửi thông báo test...\n');

        if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
            console.error('❌ Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID trong .env');
            console.log('\nVui lòng thêm vào file .env:');
            console.log('TELEGRAM_BOT_TOKEN=your_bot_token');
            console.log('TELEGRAM_CHAT_ID=your_chat_id');
            return;
        }

        const message = createTelegramMessage(sampleOrder);

        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Gửi thông báo thành công!');
            console.log('📱 Kiểm tra Telegram của bạn\n');
            console.log('Message ID:', result.result.message_id);
        } else {
            console.error('❌ Lỗi gửi thông báo:');
            console.error('Status:', response.status);
            console.error('Error:', result);
            
            if (response.status === 401) {
                console.log('\n💡 Lỗi 401: Bot Token không hợp lệ');
                console.log('Kiểm tra lại TELEGRAM_BOT_TOKEN trong .env');
            } else if (response.status === 400) {
                console.log('\n💡 Lỗi 400: Chat ID không hợp lệ hoặc bot chưa được start');
                console.log('1. Kiểm tra lại TELEGRAM_CHAT_ID trong .env');
                console.log('2. Nhắn /start cho bot trên Telegram');
            }
        }

    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    }
}

// Run test
console.log('═══════════════════════════════════════════════');
console.log('🧪 TEST THÔNG BÁO TELEGRAM');
console.log('═══════════════════════════════════════════════\n');

sendTestNotification();
