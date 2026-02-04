// ============================================
// IMAGE PREVIEW UTILITY
// ============================================

import { CONFIG } from '../constants/config.js';

/**
 * Preview product image in modal with materials
 * @param {string} imageUrl - Image URL
 * @param {string} productName - Product name
 * @param {number} productId - Product ID (optional, extracted from onclick if available)
 */
window.previewProductImage = async function(imageUrl, productName, productId) {
    const modal = document.getElementById('imagePreviewModal');
    const img = document.getElementById('imagePreviewImg');
    const title = document.getElementById('imagePreviewTitle');
    const headerTitle = document.getElementById('imagePreviewHeaderTitle');
    const materialsContainer = document.getElementById('imagePreviewMaterials');
    const imageWrapper = document.getElementById('imagePreviewImageWrapper');

    if (modal && img && title) {
        img.src = imageUrl;
        img.alt = productName;
        title.textContent = productName;
        
        // Set header title
        if (headerTitle) {
            headerTitle.textContent = productName;
        }
        
        modal.classList.add('active');

        // Store productId for button actions
        modal.dataset.productId = productId;

        // Setup fullscreen image viewer for mobile
        setupFullscreenImageViewer(imageWrapper, imageUrl, productName);

        // Setup button event listeners
        setupPreviewButtons(productId);

        // Load materials if productId is available
        if (productId) {
            await loadProductMaterials(productId, materialsContainer);
        } else {
            materialsContainer.innerHTML = '';
        }

        // Close on click outside
        modal.onclick = (e) => {
            if (e.target === modal) {
                window.closeImagePreview();
            }
        };

        // Close on ESC key
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                window.closeImagePreview();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }
};

/**
 * Setup fullscreen image viewer for mobile
 * @param {HTMLElement} imageWrapper - Image wrapper element
 * @param {string} imageUrl - Image URL
 * @param {string} productName - Product name
 */
function setupFullscreenImageViewer(imageWrapper, imageUrl, productName) {
    if (!imageWrapper) return;

    // Remove old listener
    const newImageWrapper = imageWrapper.cloneNode(true);
    imageWrapper.parentNode.replaceChild(newImageWrapper, imageWrapper);

    // Add click listener to open fullscreen on mobile
    newImageWrapper.addEventListener('click', () => {
        // Only on mobile/tablet
        if (window.innerWidth <= 768) {
            openFullscreenImage(imageUrl, productName);
        }
    });
}

/**
 * Open fullscreen image viewer
 * @param {string} imageUrl - Image URL
 * @param {string} productName - Product name
 */
function openFullscreenImage(imageUrl, productName) {
    const viewer = document.getElementById('imageFullscreenViewer');
    const img = document.getElementById('fullscreenImg');

    if (viewer && img) {
        img.src = imageUrl;
        img.alt = productName;
        viewer.classList.add('active');

        // Setup swipe down to close
        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        const container = viewer.querySelector('.fullscreen-image-container');

        container.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            isDragging = true;
        });

        container.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            currentY = e.touches[0].clientY;
            const diff = currentY - startY;

            if (diff > 0) {
                // Dragging down
                viewer.style.opacity = Math.max(0.5, 1 - diff / 300);
            }
        });

        container.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;

            const diff = currentY - startY;
            if (diff > 100) {
                // Swipe down threshold reached
                window.closeFullscreenImage();
            } else {
                // Reset
                viewer.style.opacity = 1;
            }
        });
    }
}

/**
 * Close fullscreen image viewer
 */
window.closeFullscreenImage = function() {
    const viewer = document.getElementById('imageFullscreenViewer');
    if (viewer) {
        viewer.classList.remove('active');
        viewer.style.opacity = 1;
    }
};

/**
 * Setup button event listeners for preview modal
 * @param {number} productId - Product ID
 */
function setupPreviewButtons(productId) {
    const addToCartBtn = document.getElementById('previewAddToCart');
    const buyNowBtn = document.getElementById('previewBuyNow');

    // Remove old listeners by cloning
    if (addToCartBtn) {
        const newAddToCartBtn = addToCartBtn.cloneNode(true);
        addToCartBtn.parentNode.replaceChild(newAddToCartBtn, addToCartBtn);
        
        newAddToCartBtn.addEventListener('click', () => {
            if (window.productActions && window.productActions.addToCart) {
                window.productActions.addToCart(productId);
                // Optional: close modal after adding to cart
                // window.closeImagePreview();
            }
        });
    }

    if (buyNowBtn) {
        const newBuyNowBtn = buyNowBtn.cloneNode(true);
        buyNowBtn.parentNode.replaceChild(newBuyNowBtn, buyNowBtn);
        
        newBuyNowBtn.addEventListener('click', () => {
            if (window.productActions && window.productActions.buyNow) {
                window.productActions.buyNow(productId);
                window.closeImagePreview();
            }
        });
    }
}

/**
 * Load and display product materials
 * @param {number} productId - Product ID
 * @param {HTMLElement} container - Container element
 */
async function loadProductMaterials(productId, container) {
    try {
        // Show loading state
        container.innerHTML = `
            <div class="materials-header">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/>
                </svg>
                <span>Thành phần nguyên liệu</span>
            </div>
            <div style="text-align: center; padding: 1rem; color: #95a5a6;">
                <span>Đang tải...</span>
            </div>
        `;

        const response = await fetch(`${CONFIG.API_BASE_URL}/?action=getProductMaterials&product_id=${productId}`);
        
        if (!response.ok) {
            throw new Error('Failed to load materials');
        }

        const data = await response.json();
        
        if (data.success && data.materials && data.materials.length > 0) {
            // Filter out labor cost and other non-material items
            const HIDDEN_MATERIALS = [
                'chi_phi_nhan_cong',
                'chi_phi_van_chuyen',
                'chi_phi_dong_goi',
                'chi_phi_khac'
            ];
            
            const visibleMaterials = data.materials.filter(material => 
                !HIDDEN_MATERIALS.includes(material.material_name.toLowerCase())
            );
            
            // Check for string type (dây đỏ or dây cước)
            const hasRedString = data.materials.some(m => m.material_name === 'day_do');
            const hasRopeString = data.materials.some(m => m.material_name === 'day_cuoc');
            
            // Display string type info
            displayStringTypeInfo(hasRedString, hasRopeString);
            
            // If no visible materials, hide the section
            if (visibleMaterials.length === 0) {
                container.innerHTML = '';
                return;
            }
            
            // Render materials
            const materialsHTML = visibleMaterials.map(material => {
                const displayName = material.display_name || material.material_name.replace(/_/g, ' ');
                const quantity = material.quantity;
                const unit = material.unit || '';
                
                return `
                    <div class="material-tag">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="2"/>
                        </svg>
                        <span class="material-name">${displayName}</span>
                        ${quantity ? `<span class="material-quantity">(${quantity} ${unit})</span>` : ''}
                    </div>
                `;
            }).join('');

            container.innerHTML = `
                <div class="materials-header">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/>
                    </svg>
                    <span>Thành phần nguyên liệu</span>
                </div>
                <div class="materials-list">
                    ${materialsHTML}
                </div>
            `;
        } else {
            // No materials found
            container.innerHTML = '';
            // Hide string type info if no materials
            displayStringTypeInfo(false, false);
        }
    } catch (error) {
        console.error('Error loading materials:', error);
        // Hide materials section on error
        container.innerHTML = '';
        displayStringTypeInfo(false, false);
    }
}

/**
 * Display string type information based on material
 * @param {boolean} hasRedString - Has red string material
 * @param {boolean} hasRopeString - Has rope string material
 */
function displayStringTypeInfo(hasRedString, hasRopeString) {
    const stringInfoContainer = document.getElementById('productStringInfo');
    
    if (!stringInfoContainer) return;
    
    if (hasRedString) {
        // Dây đỏ
        stringInfoContainer.className = 'product-string-info red-string';
        stringInfoContainer.style.display = 'flex';
        stringInfoContainer.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clip-rule="evenodd" />
            </svg>
            <span>Vòng có thể <strong>nới rộng khi bé lớn</strong>, mua size sơ sinh thì đến lớn bé vẫn đeo được thoải mái, không lo bị trật.</span>
        `;
    } else if (hasRopeString) {
        // Dây cước
        stringInfoContainer.className = 'product-string-info rope-string';
        stringInfoContainer.style.display = 'flex';
        stringInfoContainer.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 0 0-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.395-.634-.936-.634Zm4.314.634c.108-.215.395-.634.936-.634.54 0 .828.419.936.634.13.26.189.568.189.866 0 .298-.059.605-.189.866-.108.215-.395.634-.936.634-.54 0-.828-.419-.936-.634a1.96 1.96 0 0 1-.189-.866c0-.298.059-.605.189-.866Zm2.023 6.828a.75.75 0 1 0-1.06-1.06 3.75 3.75 0 0 1-5.304 0 .75.75 0 0 0-1.06 1.06 5.25 5.25 0 0 0 7.424 0Z" clip-rule="evenodd" />
            </svg>
            <span>Dây vòng được làm bằng <strong>dây cước gân co giãn loại 1</strong>, rất bền chắc, khó đứt, không thấm nước, gọn gàng không lo vướng.</span>
        `;
    } else {
        // No string type detected, hide
        stringInfoContainer.style.display = 'none';
    }
}

/**
 * Close image preview modal
 */
window.closeImagePreview = function() {
    const modal = document.getElementById('imagePreviewModal');
    if (modal) {
        modal.classList.remove('active');
    }
};

