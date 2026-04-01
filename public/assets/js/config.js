// Configuration file - ĐÃ CẤU HÌNH
const CONFIG = {
    // API URL - Tự động phát hiện môi trường
    API_URL: (() => {
        // localStorage.setItem('force_local_api', '1')  — luôn dùng Wrangler
        // localStorage.setItem('force_remote_api', '1') — luôn dùng Workers (thử DB production)
        if (typeof location !== 'undefined' && localStorage.getItem('force_remote_api') === '1') {
            return 'https://ctv-api.yendev96.workers.dev';
        }
        if (localStorage.getItem('force_local_api') === '1') {
            return 'http://127.0.0.1:8787';
        }
        const host = typeof location !== 'undefined' ? location.hostname : '';
        if (host === 'localhost' || host === '127.0.0.1') {
            return 'http://127.0.0.1:8787';
        }
        return 'https://ctv-api.yendev96.workers.dev';
    })(),
    
    // Commission rate (12% = 0.12)
    COMMISSION_RATE: 0.12,
    
    // Contact info
    CONTACT: {
        zaloGroup: 'https://zalo.me/g/vlyibe041',
        zaloSupport1: '0972483892',
        zaloSupport2: '0386190596'
    },
    
    // Shop URL
    SHOP_URL: 'https://shopvd.store'
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
