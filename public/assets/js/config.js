// Configuration file - ĐÃ CẤU HÌNH
const CONFIG = {
    // Google Apps Script Web App URL
    // ⚠️ SAU KHI DEPLOY GOOGLE APPS SCRIPT, CẬP NHẬT URL Ở ĐÂY
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzFpYcootskJtEtW_spvZvvHlkQJG-8G_0bfkNMEcsAfD37xrIc9KQ9kllQBF9tch6x/exec',
    
    // Google Sheets ID
    CTV_SPREADSHEET_ID: '1QOXBlIcX1Th1ZnNKulnbxEJDD-HfAiKfOFKHn2pBo4o',
    ORDER_SPREADSHEET_ID: '1CmfyZg1MCPCv0_RnlBOOf0HIev4RPg4DK43veMGyPJM',
    
    // Commission rate (10% = 0.1)
    COMMISSION_RATE: 0.1,
    
    // Contact info
    CONTACT: {
        zaloGroup: 'https://zalo.me/g/gvqvxu828',
        zaloSupport1: '0972483892',
        zaloSupport2: '0386190596'
    },
    
    // Shop URL
    SHOP_URL: 'https://shopvd.store',
    
    // Demo mode (set to false in production)
    DEMO_MODE: false
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
