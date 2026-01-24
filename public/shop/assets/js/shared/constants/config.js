// ============================================
// CONFIGURATION & CONSTANTS
// ============================================

export const CONFIG = {
    // API Configuration
    API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://127.0.0.1:8787'
        : 'https://ctv-api.yendev96.workers.dev', // ← Thay bằng URL Workers của bạn
    
    // CDN Configuration
    R2_BASE_URL: 'https://pub-857086f8ce7248b6ab3b37c688164fb1.r2.dev',
    DEFAULT_IMAGE: 'https://pub-857086f8ce7248b6ab3b37c688164fb1.r2.dev/assets/images/product_img/tat-ca-mau.webp',
    
    // Cart Configuration
    STORAGE_KEY: 'cart',
    DISCOUNT_KEY: 'discount',
    
    // Checkout Configuration
    SHIPPING_FEE: 21000,
    FREE_SHIPPING_THRESHOLD: 500000,
    
    // Flash Sale Configuration
    FLASH_SALE_ITEMS_PER_PAGE_DESKTOP: 4,
    FLASH_SALE_ITEMS_PER_PAGE_MOBILE: 2,
    FLASH_SALE_AUTO_PLAY_INTERVAL: 5000,
    
    // Pagination
    PRODUCTS_PER_PAGE: 12,
    
    // Validation
    PHONE_REGEX: /^[0-9]{10,11}$/,
    
    // Debounce
    DEBOUNCE_DELAY: 300
};

export const DISCOUNT_CODES = [
    { code: 'FREESHIP', type: 'shipping', value: 0, description: 'Miễn phí ship' },
    { code: 'NEWMOM10', type: 'percent', value: 10, description: 'Giảm 10%' },
    { code: 'SUMMER2024', type: 'fixed', value: 20000, description: 'Giảm 20.000đ' }
];

export const CATEGORY_IMAGES = {
    'Bi, charm bạc': '/assets/images/product_img/bi-bac/bi-bac-ta.webp',
    'Hạt đầu tâm mài sẵn': '/assets/images/product_img/hat_dau_tam.webp',
    'Mix bi bạc': '/assets/images/product_img/Sole-bac/vong_dau_tam_7_bi_bac.webp',
    'Mix charm chuông': '/assets/images/product_img/chuong/vong_dau_tam_sole_3ly_chuong.webp',
    'Mix dây ngũ sắc': '/assets/images/product_img/vong_tron_co_dien_day_ngu_sac.webp',
    'Mix charm rắn': '/assets/images/product_img/charm-ran/vong-9-bi-bac-charm-ran.webp',
    'Mix hạt bồ đề': '/assets/images/product_img/bo-de/vong_dau_tam_sole_9_hat_bo_de.webp',
    'Mix hổ phách': '/assets/images/product_img/Sole-ho-phach/9-ho-phach-vang-cam.webp',
    'Mix charm hoa sen': '/assets/images/product_img/hoa-sen/vong-sole-3ly-hoa-sen.webp',
    'Vòng cơ giãn': '/assets/images/product_img/co-gian/vong_tron_co_gian.webp',
    'Vòng người lớn': '/assets/images/product_img/nguoi-lon/vong-tron-nguoi-lon.webp',
    'Vòng tròn': '/assets/images/product_img/Vong-tron/vong-tron-buoc-moi.webp',
    'Vòng ngũ sắc': '/assets/images/product_img/vong_tron_co_dien_day_ngu_sac.webp',
    'Sản phẩm bán kèm': '/assets/images/product_img/tui_dau_tam.webp',
    'Mix đá đỏ': '/assets/images/product_img/da-do/vong_dau_tam_sole_3ly_da_do.webp',
    'Mix thanh giá': '/assets/images/product_img/charm-bac/thanh-gia-xo-ngang.webp',
    'Mix thẻ tên bé': '/assets/images/product_img/charm-bac/the-ten-tron.webp'
};
