// Flash Sales Service - Main exports

// Flash Sale Management
export {
    getAllFlashSales,
    getFlashSale,
    getActiveFlashSales,
    createFlashSale,
    updateFlashSale,
    deleteFlashSale,
    updateFlashSaleStatus
} from './flash-sale-service.js';

// Flash Sale Products
export {
    getFlashSaleProducts,
    addProductToFlashSale,
    addMultipleProductsToFlashSale,
    updateFlashSaleProduct,
    removeProductFromFlashSale,
    removeAllProductsFromFlashSale,
    checkProductInFlashSale,
    incrementSoldCount,
    getFlashSaleStats
} from './flash-sale-products.js';

// Flash Sale Bulk Update (Transaction-based)
export {
    updateFlashSaleProducts
} from './flash-sale-bulk-update.js';

// Validation & Utilities
export {
    checkTimeConflicts,
    validateFlashSaleData,
    validateFlashSaleProductData,
    autoUpdateFlashSaleStatus,
    canDeleteFlashSale,
    canEditFlashSale
} from './flash-sale-validation.js';
