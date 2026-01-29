// ============================================
// DISCOUNT MODAL COMPONENT
// ============================================

import { discountService } from '../shared/services/discount.service.js';
import { formatPrice, escapeHtml } from '../shared/utils/formatters.js';
import { showToast } from '../shared/utils/helpers.js';

/**
 * Discount Modal Component
 */
export class DiscountModal {
    constructor(onApply) {
        this.discounts = [];
        this.onApply = onApply; // Callback when discount is applied
        this.selectedDiscount = null;
    }
    
    /**
     * Open modal
     */
    async open(orderAmount) {
        console.log('📋 DiscountModal.open() called with amount:', orderAmount);
        this.orderAmount = orderAmount;
        
        // Load discounts
        console.log('Loading discounts...');
        await this.loadDiscounts();
        console.log('Loaded discounts:', this.discounts.length);
        
        // Render modal
        this.render();
        
        // Show modal
        this.show();
    }
    
    /**
     * Close modal
     */
    close() {
        const modal = document.getElementById('discountModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
    
    /**
     * Show modal
     */
    show() {
        const modal = document.getElementById('discountModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }
    
    /**
     * Load discounts from API
     */
    async loadDiscounts() {
        try {
            console.log('Calling discountService.getActiveDiscounts()...');
            this.discounts = await discountService.getActiveDiscounts();
            console.log('Raw discounts from API:', this.discounts);
            
            // Filter applicable discounts
            this.discounts = this.discounts.filter(d => {
                return d.active && 
                       d.visible && 
                       (!d.min_order_amount || this.orderAmount >= d.min_order_amount);
            });
            console.log('Filtered discounts:', this.discounts);
        } catch (error) {
            console.error('Error loading discounts:', error);
            this.discounts = [];
        }
    }
    
    /**
     * Render modal content
     */
    render() {
        const container = document.getElementById('discountModalContent');
        if (!container) return;
        
        if (this.discounts.length === 0) {
            container.innerHTML = '<div class="discount-empty">' +
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 3rem; height: 3rem;"><path d="M9.375 3a1.875 1.875 0 0 0 0 3.75h1.875v4.5H3.375A1.875 1.875 0 0 1 1.5 9.375v-.75c0-1.036.84-1.875 1.875-1.875h3.193A3.375 3.375 0 0 1 12 2.753a3.375 3.375 0 0 1 5.432 3.997h3.943c1.035 0 1.875.84 1.875 1.875v.75c0 1.036-.84 1.875-1.875 1.875H12.75v-4.5h1.875a1.875 1.875 0 1 0-1.875-1.875V6.75h-1.5V4.875C11.25 3.839 10.41 3 9.375 3ZM11.25 12.75H3v6.75a2.25 2.25 0 0 0 2.25 2.25h6v-9ZM12.75 12.75v9h6.75a2.25 2.25 0 0 0 2.25-2.25v-6.75h-9Z" /></svg>' +
                '<p>Không có mã giảm giá khả dụng</p>' +
                '</div>';
            return;
        }
        
        let html = '';
        
        this.discounts.forEach(discount => {
            const isApplicable = !discount.min_order_amount || this.orderAmount >= discount.min_order_amount;
            const discountText = discountService.formatDiscountText(discount);
            
            html += '<div class="discount-item ' + (isApplicable ? '' : 'disabled') + '" ';
            html += 'data-code="' + escapeHtml(discount.code) + '">';
            
            // Icon based on type
            let iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.5rem; height: 1.5rem;"><path fill-rule="evenodd" d="M5.25 2.25a3 3 0 0 0-3 3v4.318a3 3 0 0 0 .879 2.121l9.58 9.581c.92.92 2.39 1.186 3.548.428a18.849 18.849 0 0 0 5.441-5.44c.758-1.16.492-2.629-.428-3.548l-9.58-9.581a3 3 0 0 0-2.122-.879H5.25ZM6.375 7.5a1.125 1.125 0 1 0 0-2.25 1.125 1.125 0 0 0 0 2.25Z" clip-rule="evenodd" /></svg>';
            if (discount.type === 'freeship') iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.5rem; height: 1.5rem;"><path d="M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375V13.5h12V6.375c0-1.036-.84-1.875-1.875-1.875h-8.25ZM13.5 15h-12v2.625c0 1.035.84 1.875 1.875 1.875h.375a3 3 0 1 1 6 0h3a.75.75 0 0 0 .75-.75V15Z" /><path d="M8.25 19.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0ZM15.75 6.75a.75.75 0 0 0-.75.75v11.25c0 .087.015.17.042.248a3 3 0 0 1 5.958.464c.853-.175 1.522-.935 1.464-1.883a18.659 18.659 0 0 0-3.732-10.104 1.837 1.837 0 0 0-1.47-.725H15.75Z" /><path d="M19.5 19.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" /></svg>';
            if (discount.type === 'gift') iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.5rem; height: 1.5rem;"><path d="M9.375 3a1.875 1.875 0 0 0 0 3.75h1.875v4.5H3.375A1.875 1.875 0 0 1 1.5 9.375v-.75c0-1.036.84-1.875 1.875-1.875h3.193A3.375 3.375 0 0 1 12 2.753a3.375 3.375 0 0 1 5.432 3.997h3.943c1.035 0 1.875.84 1.875 1.875v.75c0 1.036-.84 1.875-1.875 1.875H12.75v-4.5h1.875a1.875 1.875 0 1 0-1.875-1.875V6.75h-1.5V4.875C11.25 3.839 10.41 3 9.375 3ZM11.25 12.75H3v6.75a2.25 2.25 0 0 0 2.25 2.25h6v-9ZM12.75 12.75v9h6.75a2.25 2.25 0 0 0 2.25-2.25v-6.75h-9Z" /></svg>';
            
            html += '<div class="discount-icon">';
            html += iconSvg;
            html += '</div>';
            
            html += '<div class="discount-info">';
            html += '<div class="discount-code">' + escapeHtml(discount.code) + '</div>';
            html += '<div class="discount-title">' + escapeHtml(discount.title) + '</div>';
            html += '<div class="discount-desc">' + discountText + '</div>';
            
            if (discount.min_order_amount) {
                html += '<div class="discount-condition">';
                html += 'Đơn tối thiểu: ' + formatPrice(discount.min_order_amount);
                html += '</div>';
            }
            
            if (discount.expiry_date) {
                const expiryDate = new Date(discount.expiry_date);
                html += '<div class="discount-expiry">';
                html += 'HSD: ' + expiryDate.toLocaleDateString('vi-VN');
                html += '</div>';
            }
            
            html += '</div>';
            
            html += '<button class="discount-apply-btn" ';
            html += 'onclick="discountModal.applyDiscount(\'' + escapeHtml(discount.code) + '\')" ';
            html += (isApplicable ? '' : 'disabled') + '>';
            html += 'Áp dụng';
            html += '</button>';
            
            html += '</div>';
        });
        
        container.innerHTML = html;
    }
    
    /**
     * Apply discount
     */
    async applyDiscount(code) {
        const discount = this.discounts.find(d => d.code === code);
        if (!discount) return;
        
        // Check minimum order amount
        if (discount.min_order_amount && this.orderAmount < discount.min_order_amount) {
            showToast('Đơn hàng chưa đủ điều kiện áp dụng mã này', 'error');
            return;
        }
        
        // Calculate discount amount
        const discountAmount = discountService.calculateDiscountAmount(discount, this.orderAmount);
        
        // Call callback
        if (this.onApply) {
            this.onApply(discount, discountAmount);
        }
        
        // Close modal
        this.close();
        
        showToast('Đã áp dụng mã giảm giá!', 'success');
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Close button
        const closeBtn = document.getElementById('discountModalClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
        
        // Click outside to close
        const modal = document.getElementById('discountModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.close();
                }
            });
        }
    }
}
