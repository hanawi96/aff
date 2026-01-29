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
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 2.5rem; height: 2.5rem;"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" /></svg>
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
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.125rem; height: 1.125rem; display: inline-block;"><path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" /></svg>
                            <em>Chúc bé luôn khỏe mạnh, bình an!</em>
                        </p>
                    </div>
                    <div class="success-modal-order-info" id="successOrderInfo"></div>
                    <div class="success-modal-actions">
                        <button class="success-modal-btn success-modal-btn-primary" id="successModalClose">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.125rem; height: 1.125rem; display: inline-block;"><path fill-rule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clip-rule="evenodd" /></svg>
                            OK
                        </button>
                        <button class="success-modal-btn success-modal-btn-secondary" id="successModalContinue">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.125rem; height: 1.125rem; display: inline-block;"><path fill-rule="evenodd" d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 0 0 4.25 22.5h15.5a1.875 1.875 0 0 0 1.865-2.071l-1.263-12a1.875 1.875 0 0 0-1.865-1.679H16.5V6a4.5 4.5 0 1 0-9 0ZM12 3a3 3 0 0 0-3 3v.75h6V6a3 3 0 0 0-3-3Zm-3 8.25a3 3 0 1 0 6 0v-.75a.75.75 0 0 1 1.5 0v.75a4.5 4.5 0 1 1-9 0v-.75a.75.75 0 0 1 1.5 0v.75Z" clip-rule="evenodd" /></svg>
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
