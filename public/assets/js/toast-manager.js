/**
 * Toast Manager - Hệ thống quản lý thông báo thông minh
 * Giải quyết vấn đề toast chồng lên nhau
 */

class ToastManager {
    constructor() {
        this.toasts = [];
        this.maxToasts = 3;
        this.container = null;
        this.init();
    }

    init() {
        // Tạo container cho toasts với z-index cao nhất
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.className = 'fixed bottom-4 right-4 flex flex-col gap-2 pointer-events-none';
        this.container.style.maxWidth = '400px';
        this.container.style.zIndex = '9999'; // Cao hơn tất cả modal
        document.body.appendChild(this.container);
    }

    /**
     * Hiển thị toast mới
     * @param {string} message - Nội dung thông báo
     * @param {string} type - Loại: 'success', 'error', 'warning', 'info'
     * @param {number} duration - Thời gian hiển thị (ms), 0 = không tự động ẩn
     * @param {string} id - ID để thay thế toast cũ (optional)
     */
    show(message, type = 'success', duration = null, id = null) {
        // Nếu có ID và toast cũ tồn tại, thay thế nó
        if (id) {
            const existingToast = this.toasts.find(t => t.id === id);
            if (existingToast) {
                this.updateToast(existingToast, message, type, duration);
                return;
            }
        }

        // Tự động ẩn toast "info" cũ khi có toast mới cùng context
        if (type !== 'info') {
            const oldInfoToast = this.toasts.find(t => t.type === 'info' && !t.id);
            if (oldInfoToast) {
                this.remove(oldInfoToast);
            }
        }

        // Xác định thời gian hiển thị
        if (duration === null) {
            duration = type === 'error' ? 5000 : type === 'warning' ? 4000 : 3000;
        }

        // Tạo toast element
        const toast = this.createToastElement(message, type, id);

        // Thêm vào container
        this.container.appendChild(toast.element);

        // Thêm vào danh sách
        this.toasts.push(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.element.classList.add('toast-show');
        });

        // Tự động ẩn sau duration (nếu không phải 0)
        if (duration > 0) {
            toast.timeout = setTimeout(() => {
                this.remove(toast);
            }, duration);
        }

        // Giới hạn số lượng toast
        this.limitToasts();
    }

    /**
     * Cập nhật toast đã tồn tại
     */
    updateToast(toast, message, type, duration) {
        // Clear timeout cũ
        if (toast.timeout) {
            clearTimeout(toast.timeout);
        }

        // Cập nhật nội dung
        const messageEl = toast.element.querySelector('.toast-message');
        const iconEl = toast.element.querySelector('.toast-icon');

        if (messageEl) messageEl.textContent = message;
        if (iconEl) iconEl.innerHTML = this.getIcon(type);

        // Cập nhật màu sắc với animation
        toast.element.style.transition = 'background-color 0.3s ease';
        toast.element.className = toast.element.className.replace(/bg-\w+-500/g, this.getColor(type));

        // Cập nhật type
        toast.type = type;

        // Set timeout mới
        if (duration === null) {
            duration = type === 'error' ? 5000 : type === 'warning' ? 4000 : 3000;
        }

        if (duration > 0) {
            toast.timeout = setTimeout(() => {
                this.remove(toast);
            }, duration);
        }
    }

    /**
     * Tạo toast element
     */
    createToastElement(message, type, id) {
        const element = document.createElement('div');
        element.className = `toast-item flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white pointer-events-auto ${this.getColor(type)}`;
        element.style.transform = 'translateX(400px)';
        element.style.opacity = '0';
        element.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

        element.innerHTML = `
            <div class="toast-icon flex-shrink-0">
                ${this.getIcon(type)}
            </div>
            <div class="toast-message flex-1 text-sm font-medium">
                ${message}
            </div>
            <button class="toast-close flex-shrink-0 hover:bg-white/20 rounded p-1 transition-colors" onclick="toastManager.removeByElement(this.parentElement)">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        `;

        return {
            element,
            type,
            id,
            timeout: null
        };
    }

    /**
     * Lấy màu sắc theo loại
     */
    getColor(type) {
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };
        return colors[type] || colors.info;
    }

    /**
     * Lấy icon theo loại
     */
    getIcon(type) {
        const icons = {
            success: `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>`,
            error: `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>`,
            warning: `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>`,
            info: `<svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>`
        };
        return icons[type] || icons.info;
    }

    /**
     * Xóa toast
     */
    remove(toast) {
        if (!toast || !toast.element) return;

        // Clear timeout
        if (toast.timeout) {
            clearTimeout(toast.timeout);
        }

        // Animation ẩn
        toast.element.style.transform = 'translateX(400px)';
        toast.element.style.opacity = '0';

        setTimeout(() => {
            if (toast.element && toast.element.parentElement) {
                toast.element.remove();
            }
            this.toasts = this.toasts.filter(t => t !== toast);
        }, 300);
    }

    /**
     * Xóa toast bằng element (dùng cho nút close)
     */
    removeByElement(element) {
        const toast = this.toasts.find(t => t.element === element);
        if (toast) {
            this.remove(toast);
        }
    }

    /**
     * Giới hạn số lượng toast hiển thị
     */
    limitToasts() {
        while (this.toasts.length > this.maxToasts) {
            const oldestToast = this.toasts[0];
            this.remove(oldestToast);
        }
    }

    /**
     * Xóa tất cả toast
     */
    clearAll() {
        this.toasts.forEach(toast => this.remove(toast));
    }
}

// Khởi tạo global instance
const toastManager = new ToastManager();

/**
 * Hàm helper để tương thích với code cũ
 */
function showToast(message, type = 'success', duration = null, id = null) {
    toastManager.show(message, type, duration, id);
}

// CSS cho animation
const style = document.createElement('style');
style.textContent = `
    .toast-show {
        transform: translateX(0) !important;
        opacity: 1 !important;
    }
    
    .toast-item {
        min-width: 280px;
        max-width: 400px;
    }
    
    @media (max-width: 640px) {
        #toast-container {
            left: 1rem;
            right: 1rem;
            bottom: 1rem;
        }
        
        .toast-item {
            min-width: auto;
            width: 100%;
        }
    }
`;
document.head.appendChild(style);
