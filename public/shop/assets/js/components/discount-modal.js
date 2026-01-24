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
                '<i class="fas fa-ticket-alt"></i>' +
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
            let icon = 'fa-tag';
            if (discount.type === 'freeship') icon = 'fa-shipping-fast';
            if (discount.type === 'gift') icon = 'fa-gift';
            
            html += '<div class="discount-icon">';
            html += '<i class="fas ' + icon + '"></i>';
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
