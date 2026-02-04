// ============================================
// MODAL CONSTANTS
// Centralized configuration for modal behavior
// ============================================

export const MODAL_CONSTANTS = {
    // Breakpoints
    MOBILE_BREAKPOINT: 768,
    TABLET_BREAKPOINT: 1024,
    
    // Swipe gesture thresholds
    SWIPE_THRESHOLD: 100,
    SWIPE_OPACITY_DIVISOR: 300,
    MIN_SWIPE_OPACITY: 0.5,
    
    // Animation durations (ms)
    FADE_DURATION: 200,
    SLIDE_DURATION: 300,
    
    // Image settings
    MAX_IMAGE_HEIGHT_DESKTOP: 500,
    MAX_IMAGE_HEIGHT_MOBILE: 350,
    
    // Cache settings
    MATERIALS_CACHE_TTL: 5 * 60 * 1000, // 5 minutes
    MAX_CACHE_SIZE: 50,
    
    // Hidden materials (cost items) - support multiple formats
    HIDDEN_MATERIALS: [
        'chi_phi_nhan_cong',
        'chi_phí_nhân_công',
        'chi phí nhân công',
        'chi_phi_van_chuyen',
        'chi_phi_dong_goi',
        'chi_phi_khac',
        'labor_cost',
        'shipping_cost'
    ],
    
    // Material types
    MATERIAL_TYPES: {
        RED_STRING: 'day_do',
        RAINBOW_STRING: 'day_ngu_sac',
        ROPE_STRING: 'day_cuoc'
    }
};
