/**
 * Success Modal Component
 * Reusable success notification modal for order completion
 */

export class SuccessModal {
    constructor() {
        this.modal = null;
        this.init();
    }

    /**
     * Initialize modal
     */
    init() {
        // Create modal HTML if not exists
        if (!document.getElementById('successModal')) {
            this.createModal();
        }
        this.modal = document.getElementById('successModal');
        this.setupEventListeners();
    }

    /**
     * Create modal HTML
     */
    createModal() {
        const modalHTML = `
            <div class="success-modal hidden" id="successModal">
                <div class="success-modal-overlay"></div>
                <div class="success-modal-content">
                    <div class="success-modal-header">
                        <div class="success-modal-icon-inline">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <h2 class="success-modal-title">Đặt hàng thành công!</h2>
                    </div>
                    <div class="success-modal-message">
                        <p class="success-message-main">
                            <strong>Cảm ơn mẹ đã tin tưởng và lựa chọn vòng đầu tằm thủ công của chúng mình! ❤️</strong>
                        </p>
                        <p class="success-message-sub">
                            Mỗi chiếc vòng đều được làm bằng tay tỉ mỉ, gửi gắm yêu thương và mong ước tốt đẹp nhất đến bé yêu của mẹ. 
                            Chúng mình sẽ liên hệ với mẹ trong thời gian sớm nhất để xác nhận đơn hàng.
                        </p>
                        <p class="success-message-note">
                            <i class="fas fa-heart"></i>
                            <em>Chúc bé luôn khỏe mạnh, bình an!</em>
                        </p>
                    </div>
                    <div class="success-modal-order-info" id="successOrderInfo"></div>
                    <div class="success-modal-actions">
                        <button class="success-modal-btn success-modal-btn-primary" id="successModalClose">
                            <i class="fas fa-check"></i>
                            OK
                        </button>
                        <button class="success-modal-btn success-modal-btn-secondary" id="successModalContinue">
                            <i class="fas fa-shopping-bag"></i>
                            Tiếp tục mua sắm
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const closeBtn = document.getElementById('successModalClose');
        const continueBtn = document.getElementById('successModalContinue');
        const overlay = this.modal?.querySelector('.success-modal-overlay');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                this.close();
                // Redirect to home or products page
                window.location.href = '/shop/';
            });
        }

        if (overlay) {
            overlay.addEventListener('click', () => this.close());
        }

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal && !this.modal.classList.contains('hidden')) {
                this.close();
            }
        });
    }

    /**
     * Show modal with order info
     * @param {Object} orderData - Order information
     */
    show(orderData = {}) {
        if (!this.modal) return;

        // Update order info if provided
        if (orderData.orderId) {
            const orderInfoEl = document.getElementById('successOrderInfo');
            if (orderInfoEl) {
                orderInfoEl.innerHTML = `
                    <div class="success-order-detail">
                        <span class="success-order-label">Mã đơn hàng:</span>
                        <span class="success-order-value">${orderData.orderId}</span>
                    </div>
                    ${orderData.total ? `
                    <div class="success-order-detail">
                        <span class="success-order-label">Tổng tiền:</span>
                        <span class="success-order-value">${this.formatPrice(orderData.total)}</span>
                    </div>
                    ` : ''}
                `;
            }
        }

        // Show modal with animation
        this.modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Trigger animation
        setTimeout(() => {
            this.modal.classList.add('show');
        }, 10);
    }

    /**
     * Close modal
     */
    close() {
        if (!this.modal) return;

        this.modal.classList.remove('show');
        
        setTimeout(() => {
            this.modal.classList.add('hidden');
            document.body.style.overflow = '';
        }, 300);
    }

    /**
     * Format price
     */
    formatPrice(price) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(price);
    }
}

// Create singleton instance
export const successModal = new SuccessModal();
