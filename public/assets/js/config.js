// Configuration file - ĐÃ CẤU HÌNH
const CONFIG = {
    // Google Apps Script Web App URL
    // ⚠️ SAU KHI DEPLOY GOOGLE APPS SCRIPT, CẬP NHẬT URL Ở ĐÂY
    API_URL: 'https://ctv-api.yendev96.workers.dev', // Production
    // API_URL: 'http://127.0.0.1:8787', // Local development
    
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
