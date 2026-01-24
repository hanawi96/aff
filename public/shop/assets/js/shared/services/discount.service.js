// ============================================
// DISCOUNT SERVICE - Discount Management
// ============================================

import { apiService } from './api.service.js';

class DiscountService {
    constructor() {
        this.appliedDiscount = null;
    }
    
    /**
     * Get all active discounts
     */
    async getActiveDiscounts() {
        try {
            const response = await apiService.get('/get', { action: 'getActiveDiscounts' });
            return response.discounts || [];
        } catch (error) {
            console.error('Error loading discounts:', error);
            return [];
        }
    }
    
    /**
     * Validate and apply discount code
     */
    async validateDiscount(code, orderAmount, customerPhone = null) {
        try {
            const response = await apiService.post('validateDiscount', {
                code,
                orderAmount,
                customerPhone
            });
            
            if (response.valid) {
                this.appliedDiscount = response.discount;
                return {
                    valid: true,
                    discount: response.discount,
                    discountAmount: response.discountAmount
                };
            }
            
            return {
                valid: false,
                message: response.message || 'Mã giảm giá không hợp lệ'
            };
        } catch (error) {
            console.error('Error validating discount:', error);
            return {
                valid: false,
                message: 'Có lỗi xảy ra khi kiểm tra mã giảm giá'
            };
        }
    }
    
    /**
     * Calculate discount amount
     */
    calculateDiscountAmount(discount, orderAmount) {
        if (!discount) return 0;
        
        switch (discount.type) {
            case 'fixed':
                return Math.min(discount.discount_value, orderAmount);
                
            case 'percentage':
                const percentAmount = Math.floor(orderAmount * discount.discount_value / 100);
                return discount.max_discount_amount 
                    ? Math.min(percentAmount, discount.max_discount_amount)
                    : percentAmount;
                    
            case 'freeship':
                return 0; // Handled separately in shipping calculation
                
            default:
                return 0;
        }
    }
    
    /**
     * Check if discount provides free shipping
     */
    isFreeShipping(discount) {
        return discount && discount.type === 'freeship';
    }
    
    /**
     * Get applied discount
     */
    getAppliedDiscount() {
        return this.appliedDiscount;
    }
    
    /**
     * Clear applied discount
     */
    clearDiscount() {
        this.appliedDiscount = null;
    }
    
    /**
     * Format discount display text
     */
    formatDiscountText(discount) {
        if (!discount) return '';
        
        switch (discount.type) {
            case 'fixed':
                return `Giảm ${this.formatPrice(discount.discount_value)}`;
                
            case 'percentage':
                const text = `Giảm ${discount.discount_value}%`;
                return discount.max_discount_amount
                    ? `${text} (tối đa ${this.formatPrice(discount.max_discount_amount)})`
                    : text;
                    
            case 'freeship':
                return 'Miễn phí ship';
                
            case 'gift':
                return `Tặng ${discount.gift_product_name}`;
                
            default:
                return '';
        }
    }
    
    /**
     * Format price helper
     */
    formatPrice(price) {
        return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
    }
}

// Export singleton instance
export const discountService = new DiscountService();
