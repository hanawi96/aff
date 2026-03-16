// Configuration file - ĐÃ CẤU HÌNH
const CONFIG = {
    // API URL - Tự động phát hiện môi trường
    API_URL: (() => {
        // Nếu đang chạy local (port 5500 hoặc localhost)
        if (window.location.port === '5500' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://127.0.0.1:8787';
        }
        // Production
        return 'https://ctv-api.yendev96.workers.dev';
    })(),
    
    // Google Sheets ID
    CTV_SPREADSHEET_ID: '1axooVOgwVsgwAqCE59afdz6RQOWNV1j4WUGQrBvUHiI',
    ORDER_SPREADSHEET_ID: '1XNdGOYAVYa4BdZFEVZicMLbX8nJ3J--2HPJjltD9r-k',
    
    // Commission rate (10% = 0.1)
    COMMISSION_RATE: 0.1,
    
    // Contact info
    CONTACT: {
        zaloGroup: 'https://zalo.me/g/vlyibe041',
        zaloSupport1: '0972483892',
        zaloSupport2: '0386190596'
    },
    
    // Shop URL
    SHOP_URL: 'https://shopvd.store',
    
    // Demo mode (set to false in production)
    DEMO_MODE: true
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
