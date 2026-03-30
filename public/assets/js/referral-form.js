// Form handling and submission
console.log('[CTV-Referral] referral-form.js loaded');
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('referralForm');
    const successMessage = document.getElementById('successMessage');

    // Form submission
    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        // Remove any previous inline error
        const existingError = form.querySelector('.submit-error');
        if (existingError) existingError.remove();

        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;

        // Show loading state
        submitButton.innerHTML = '<svg class="animate-spin h-5 w-5 mr-2 inline-block" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Đang gửi...';
        submitButton.disabled = true;

        try {
            // Collect form data
            const formData = new FormData(form);
            const data = {};

            for (let [key, value] of formData.entries()) {
                data[key] = value;
            }

            // Add timestamp (UTC)
            data.timestamp = new Date().toISOString();

            // Send to Cloudflare Worker API
            const API_URL = CONFIG.API_URL + '/api/submit';

            console.log('Sending data to API:', data);
            console.log('URL:', API_URL);

            // Send with proper CORS handling
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
                redirect: 'follow'
            });

            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);

            // Check response
            const responseText = await response.text();
            console.log('Raw response:', responseText);

            let result;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                throw new Error('Invalid response from server');
            }

            console.log('Parsed response:', result);

            if (!result.success) {
                throw new Error(result.error || 'Failed to save data');
            }

            // Validate response data - ensure we have the referral code and URL
            if (!result.referralCode || !result.referralUrl) {
                console.error('Missing referral data in response:', result);
                console.error('Full result object:', JSON.stringify(result, null, 2));
                throw new Error('Server did not return referral information');
            }

            const refCode = result.referralCode;
            const refUrl = result.referralUrl;

            console.log('✓ Referral Code:', refCode);
            console.log('✓ Referral URL:', refUrl);
            console.log('✓ Full Name:', data.fullName);

            // Lưu kết quả vào sessionStorage để URL success gọn (không dài query string)
            var CTV_SUCCESS_KEY = 'ctv_registration_success';
            try {
                sessionStorage.setItem(CTV_SUCCESS_KEY, JSON.stringify({
                    refCode: refCode,
                    refUrl: refUrl,
                    name: data.fullName || ''
                }));
                window.location.href = 'success.html';
            } catch (storageErr) {
                console.warn('sessionStorage không khả dụng, dùng query string:', storageErr);
                var params = new URLSearchParams({
                    refCode: refCode,
                    refUrl: refUrl,
                    name: data.fullName || ''
                });
                window.location.href = 'success.html?' + params.toString();
            }

        } catch (error) {
            console.error('Error:', error);
            // Show inline error below button instead of blocking alert
            const existingError = form.querySelector('.submit-error');
            if (existingError) existingError.remove();

            const errorDiv = document.createElement('div');
            errorDiv.className = 'submit-error text-sm text-red-600 mt-2 text-center font-medium animate-[fadeIn_0.3s_ease-out]';
            errorDiv.textContent = error.message || 'Có lỗi xảy ra khi gửi form. Vui lòng thử lại sau!';
            submitButton.parentElement.appendChild(errorDiv);
        } finally {
            // Reset button
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
        }
    });

    // Form validation enhancements
    const requiredFields = form.querySelectorAll('[required]');
    requiredFields.forEach(field => {
        field.addEventListener('blur', function () {
            validateField(this);
        });
    });

    function validateField(field) {
        const value = field.value.trim();
        const fieldContainer = field.parentElement;

        // Remove existing error styling
        field.classList.remove('border-red-300', 'ring-red-500');
        const existingError = fieldContainer.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        if (field.hasAttribute('required') && !value) {
            showFieldError(field, 'Trường này là bắt buộc');
            return false;
        }

        // Email validation
        if (field.type === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                showFieldError(field, 'Email không hợp lệ');
                return false;
            }
        }

        // Phone validation
        if (field.type === 'tel' && value) {
            const phoneRegex = /^[0-9]{10,11}$/;
            if (!phoneRegex.test(value.replace(/\s/g, ''))) {
                showFieldError(field, 'Số điện thoại không hợp lệ');
                return false;
            }
        }

        return true;
    }

    function showFieldError(field, message) {
        field.classList.add('border-red-300', 'ring-red-500');

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message text-red-500 text-sm mt-1';
        errorDiv.textContent = message;

        field.parentElement.appendChild(errorDiv);
    }

    // Phone number formatting
    const phoneInput = document.querySelector('input[name="phone"]');
    if (phoneInput) {
        phoneInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) {
                value = value.slice(0, 11);
            }
            e.target.value = value;
        });
    }


    window.showCommissionModal = function () {
        // Update URL with hash
        window.history.pushState({ modal: 'commission' }, '', '#cach-tinh-hoa-hong');

        // Tính ngày hiện tại
        const today = new Date();
        const day = today.getDate();
        const month = today.getMonth() + 1;
        const year = today.getFullYear();
        const currentDate = day + '/' + month + '/' + year;

        // Create commission modal (inline fixed + inset so overlay is viewport-bound even if Tailwind misses)
        const commissionModal = document.createElement('div');
        commissionModal.id = 'commissionModal';
        commissionModal.className = 'bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 sm:p-6';
        commissionModal.style.position = 'fixed';
        commissionModal.style.top = '0';
        commissionModal.style.right = '0';
        commissionModal.style.bottom = '0';
        commissionModal.style.left = '0';
        commissionModal.style.zIndex = '60';
        commissionModal.style.paddingTop = 'max(2rem, env(safe-area-inset-top))';
        commissionModal.style.paddingBottom = 'max(2rem, env(safe-area-inset-bottom))';

        commissionModal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden flex flex-col" style="max-height: calc(100vh - 4rem); max-height: calc(100dvh - 4rem);">
                <!-- Header -->
                <div class="bg-gradient-to-r from-pink-500 to-purple-600 px-3 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between flex-shrink-0">
                    <h2 class="text-sm sm:text-lg font-bold text-white">Cách Tính Hoa Hồng</h2>
                    <button onclick="closeCommissionModal()" class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors flex-shrink-0" title="Đóng">
                        <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                </div>

                <!-- Content - Scrollable -->
                <div class="p-4 sm:p-5 overflow-y-auto flex-1 modal-content-scroll">
                    <!-- Commission Rate Card -->
                    <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 mb-4 border border-green-200">
                        <p class="text-sm text-gray-700 leading-relaxed">
                            Tỉ lệ hoa hồng cập nhật ngày <span class="font-semibold text-green-600">${currentDate}</span> là: <span class="text-2xl font-bold text-green-600">10%</span>
                        </p>
                    </div>

                    <!-- Rule 1: Exclude Shipping -->
                    <div class="mb-4">
                        <div class="flex items-center justify-center space-x-2 mb-3">
                            <div class="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                                <span class="text-white font-bold text-sm">1</span>
                            </div>
                            <h3 class="font-bold text-gray-800 text-base">Tính Trên Giá Sản Phẩm</h3>
                        </div>
                        <p class="text-sm text-gray-600 mb-3 text-center px-4">Hoa hồng được tính trên giá trị sản phẩm, không bao gồm phí ship.</p>
                        
                        <div class="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-3.5 border border-purple-200">
                            <p class="text-xs font-medium text-purple-700 mb-2.5 flex items-center gap-1.5">
                                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"></path>
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clip-rule="evenodd"></path>
                                </svg>
                                Ví dụ:
                            </p>
                            
                            <div class="space-y-1.5 text-sm">
                                <div class="flex justify-between items-center py-1.5 px-2.5 bg-white/60 rounded">
                                    <span class="text-gray-600">Giá sản phẩm</span>
                                    <span class="font-semibold text-gray-800">1.000.000đ</span>
                                </div>
                                
                                <div class="flex justify-between items-center py-1.5 px-2.5 bg-white/60 rounded">
                                    <span class="text-gray-600">Phí ship</span>
                                    <span class="font-semibold text-gray-800">30.000đ</span>
                                </div>
                                
                                <div class="flex justify-between items-center py-1 px-2.5 text-xs border-t border-purple-200/50 mt-2 pt-2">
                                    <span class="text-gray-500">Tổng khách trả</span>
                                    <span class="text-gray-600">1.030.000đ</span>
                                </div>
                                
                                <div class="bg-green-50 border-2 border-green-500 rounded-lg mt-3 p-3">
                                    <div class="flex justify-between items-center mb-1">
                                        <span class="text-green-700 font-semibold flex items-center gap-1.5">
                                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"></path>
                                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clip-rule="evenodd"></path>
                                            </svg>
                                            Hoa hồng 10%
                                        </span>
                                        <span class="text-green-700 font-bold text-xl">100.000đ</span>
                                    </div>
                                    <div class="text-green-600 text-xs bg-white/70 rounded px-2 py-1">
                                        1.000.000đ × 10% = 100.000đ
                                    </div>
                                </div>
                            </div>
                            
                            <p class="text-xs text-gray-500 mt-2.5 pl-1">* Tính trên 1.000.000đ (không tính ship 30k)</p>
                        </div>
                    </div>

                    <!-- Rule 2: 7 Days -->
                    <div class="mb-4">
                        <div class="flex items-center justify-center space-x-2 mb-3">
                            <div class="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                                <span class="text-white font-bold text-sm">2</span>
                            </div>
                            <h3 class="font-bold text-gray-800 text-base">Mã Lưu 7 Ngày</h3>
                        </div>
                        <p class="text-sm text-gray-600 mb-3 text-center px-4">Khi khách click vào link của bạn, mã giới thiệu được lưu trong 7 ngày. Bất kỳ đơn hàng nào trong 7 ngày đó đều tính hoa hồng cho bạn.</p>
                        
                        <div class="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-3 border border-blue-200">
                            <p class="text-sm text-gray-700 font-medium mb-2">Ví dụ:</p>
                            <div class="space-y-1.5 text-sm">
                                <p class="text-gray-600">• Ngày 1: Chị Lan click vào link của bạn</p>
                                <p class="text-gray-600">• Ngày 3: Chị Lan mua đồ 800k → Bạn nhận 80k</p>
                                <p class="text-gray-600">• Ngày 6: Chị Lan mua thêm 500k → Bạn nhận 50k</p>
                                <p class="text-blue-600 font-medium">• Ngày 7: Chị Lan click lại link → Gia hạn thêm 7 ngày</p>
                                <p class="text-gray-600">• Ngày 10: Chị Lan mua 600k → Bạn vẫn nhận 60k</p>
                                <p class="text-green-600 font-semibold mt-2 pt-2 border-t border-blue-300">✓ Tổng: 190.000đ hoa hồng</p>
                                <p class="text-xs text-gray-500 italic mt-1">💡 Click lại link = Gia hạn thêm 7 ngày mới</p>
                            </div>
                        </div>
                    </div>

                    <!-- Summary -->
                    <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 mb-2 border border-green-200">
                        <p class="text-sm text-gray-700 font-medium mb-2">📌 Tóm Tắt:</p>
                        <div class="space-y-1 text-sm text-gray-600">
                            <p>• Link có hiệu lực 7 ngày</p>
                            <p>• Hoa hồng 10% trên giá sản phẩm không tính phí ship</p>
                            <p>• Thanh toán cuối mỗi tháng</p>
                        </div>
                    </div>

                </div>
                
                <!-- Footer - Fixed at bottom -->
                <div class="p-3 sm:p-5 pt-2 sm:pt-3 border-t border-gray-100 flex-shrink-0 bg-white">
                    <div class="grid grid-cols-2 gap-2 sm:gap-3">
                        <a href="https://zalo.me/g/vlyibe041" target="_blank"
                            class="bg-blue-500 text-white py-2 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-base font-medium hover:bg-blue-600 hover:shadow-lg transition-all flex items-center justify-center space-x-1.5 sm:space-x-2">
                            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.855 1.371 5.424 3.514 7.15v3.607l3.456-1.893c.923.255 1.897.393 2.903.393 5.523 0 10-4.145 10-9.257C22 6.145 17.523 2 12 2zm.993 12.535l-2.558-2.73-4.993 2.73 5.492-5.832 2.62 2.73 4.931-2.73-5.492 5.832z"/>
                            </svg>
                            <span>Tham gia nhóm Zalo</span>
                        </a>
                        <button onclick="closeCommissionModal()" 
                            class="bg-gradient-to-r from-pink-500 to-purple-600 text-white py-2 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-base font-medium hover:from-pink-600 hover:to-purple-700 hover:shadow-lg transition-all">
                            Đã Hiểu
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(commissionModal);

        // Click outside to close
        commissionModal.addEventListener('click', function (e) {
            if (e.target === commissionModal) {
                closeCommissionModal();
            }
        });
    };

    window.closeCommissionModal = function () {
        // Remove hash from URL
        if (window.location.hash === '#cach-tinh-hoa-hong') {
            window.history.back();
        }

        const modal = document.getElementById('commissionModal');
        if (modal) {
            modal.remove(); // Instant close, no animation
        }
    };

    window.shareCommissionPage = function () {
        const shareUrl = window.location.origin + window.location.pathname + '#cach-tinh-hoa-hong';
        const shareText = 'Xem cách tính hoa hồng 10% khi trở thành cộng tác viên!';

        // Check if Web Share API is available (mobile)
        if (navigator.share) {
            navigator.share({
                title: 'Cách Tính Hoa Hồng',
                text: shareText,
                url: shareUrl
            }).catch(() => {
                // User cancelled or error, fallback to copy
                copyToClipboard(shareUrl);
            });
        } else {
            // Fallback: Copy to clipboard
            copyToClipboard(shareUrl);
        }
    };

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('✓ Đã copy link chia sẻ!');
        }).catch(() => {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('✓ Đã copy link chia sẻ!');
        });
    }


// Hash routing for commission modal
window.addEventListener('load', function () {
    // Check if URL has commission hash on page load
    if (window.location.hash === '#cach-tinh-hoa-hong') {
        showCommissionModal();
    }
});

// Handle browser back/forward buttons
window.addEventListener('popstate', function (e) {
    if (window.location.hash === '#cach-tinh-hoa-hong') {
        // Open modal if hash is present
        if (!document.getElementById('commissionModal')) {
            showCommissionModal();
        }
    } else {
        // Close modal if hash is removed
        const modal = document.getElementById('commissionModal');
        if (modal) {
            modal.remove();
        }
    }
});

// Smooth scroll for better UX
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Motivation preset selection
window.selectMotivation = function (button, text) {
    const textarea = document.getElementById('motivationText');
    const currentValue = textarea.value.trim();

    // Toggle selection
    const isSelected = button.classList.contains('selected');

    if (isSelected) {
        // Deselect - remove this text from textarea
        const lines = currentValue.split('\n').filter(line => line.trim() !== text);
        textarea.value = lines.join('\n').trim();
        button.classList.remove('selected', 'border-mom-pink', 'bg-mom-pink/20', 'text-mom-pink',
            'border-mom-blue', 'bg-mom-blue/20', 'text-mom-blue',
            'border-mom-purple', 'bg-mom-purple/20', 'text-mom-purple');
        button.classList.add('border-gray-300', 'bg-white');
    } else {
        // Select - add text to textarea
        const newValue = currentValue ? currentValue + '\n' + text : text;
        textarea.value = newValue;

        // Add selected styling based on button's hover color
        button.classList.remove('border-gray-300', 'bg-white');
        if (button.classList.contains('hover:border-mom-pink')) {
            button.classList.add('selected', 'border-mom-pink', 'bg-mom-pink/20', 'text-mom-pink');
        } else if (button.classList.contains('hover:border-mom-blue')) {
            button.classList.add('selected', 'border-mom-blue', 'bg-mom-blue/20', 'text-mom-blue');
        } else if (button.classList.contains('hover:border-mom-purple')) {
            button.classList.add('selected', 'border-mom-purple', 'bg-mom-purple/20', 'text-mom-purple');
        }
    }
};


// ============================================
// BANK DROPDOWN FUNCTIONALITY
// ============================================

function initBankDropdown() {
    const bankSelectButton = document.getElementById('bankSelectButton');
    const bankSearchInput = document.getElementById('bankSearchInput');
    const bankDropdown = document.getElementById('bankDropdown');
    const bankNameValue = document.getElementById('bankNameValue');
    const bankSelectedText = document.getElementById('bankSelectedText');
    const bankDropdownIcon = document.getElementById('bankDropdownIcon');
    const bankOptions = document.querySelectorAll('.bank-option');

    console.log('[CTV-Referral] bank dropdown init', {
        bankSelectButton: !!bankSelectButton,
        bankSearchInput: !!bankSearchInput,
        bankDropdown: !!bankDropdown,
        bankNameValue: !!bankNameValue,
        bankSelectedText: !!bankSelectedText,
        bankDropdownIcon: !!bankDropdownIcon,
        bankOptionsCount: bankOptions ? bankOptions.length : 0
    });

    // Exit if elements don't exist (e.g., using native select instead of custom dropdown)
    if (!bankSelectButton || !bankSearchInput || !bankDropdown) return;

    // Toggle dropdown when button is clicked
    bankSelectButton.addEventListener('click', function (e) {
        e.stopPropagation();
        const isHidden = bankDropdown.classList.contains('hidden');

        console.log('[CTV-Referral] bank select clicked', {
            isHiddenBefore: isHidden,
            classList: bankDropdown.className
        });

        if (isHidden) {
            bankDropdown.classList.remove('hidden');
            bankDropdownIcon.style.transform = 'rotate(180deg)';
            // Focus on search input when dropdown opens
            setTimeout(() => bankSearchInput.focus(), 100);
            filterBankOptions('');
        } else {
            bankDropdown.classList.add('hidden');
            bankDropdownIcon.style.transform = 'rotate(0deg)';
        }

        console.log('[CTV-Referral] bank dropdown class after toggle', {
            isHiddenAfter: bankDropdown.classList.contains('hidden'),
            classList: bankDropdown.className
        });
    });

    // Search functionality
    bankSearchInput.addEventListener('input', function () {
        filterBankOptions(this.value.toLowerCase());
    });

    // Prevent dropdown from closing when clicking inside search input
    bankSearchInput.addEventListener('click', function (e) {
        e.stopPropagation();
    });

    // Filter bank options based on search
    function filterBankOptions(searchTerm) {
        const optionsList = bankDropdown.querySelector('.max-h-60');
        let noResultsDiv = document.getElementById('noResultsMessage');

        let hasVisibleOptions = false;

        console.log('[CTV-Referral] filterBankOptions', { searchTerm });

        bankOptions.forEach(option => {
            const text = option.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                option.style.display = 'block';
                hasVisibleOptions = true;
            } else {
                option.style.display = 'none';
            }
        });

        // Show/hide "No results" message
        if (!hasVisibleOptions && searchTerm) {
            if (!noResultsDiv) {
                noResultsDiv = document.createElement('div');
                noResultsDiv.id = 'noResultsMessage';
                noResultsDiv.className = 'px-4 py-3 text-center text-gray-500 text-sm';
                noResultsDiv.textContent = 'Không tìm thấy ngân hàng';
                optionsList.appendChild(noResultsDiv);
            }
            noResultsDiv.style.display = 'block';
        } else if (noResultsDiv) {
            noResultsDiv.style.display = 'none';
        }

        // Log how many options are currently visible
        const visibleCount = Array.from(bankOptions).filter(opt => opt.style.display !== 'none').length;
        console.log('[CTV-Referral] filter result', { hasVisibleOptions, visibleCount });
    }

    // Handle option selection
    bankOptions.forEach(option => {
        option.addEventListener('click', function () {
            const value = this.getAttribute('data-value');
            const text = this.textContent.trim();

            if (value) {
                bankNameValue.value = value;
                bankSelectedText.textContent = value;
                bankSelectedText.classList.remove('text-gray-500');
                bankSelectedText.classList.add('text-gray-900');
            } else {
                bankNameValue.value = '';
                bankSelectedText.textContent = 'Chọn ngân hàng';
                bankSelectedText.classList.add('text-gray-500');
                bankSelectedText.classList.remove('text-gray-900');
            }

            bankSearchInput.value = '';
            bankDropdown.classList.add('hidden');
            bankDropdownIcon.style.transform = 'rotate(0deg)';
        });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function (event) {
        if (!bankSelectButton.contains(event.target) && !bankDropdown.contains(event.target)) {
            bankDropdown.classList.add('hidden');
            bankDropdownIcon.style.transform = 'rotate(0deg)';
            bankSearchInput.value = '';
        }
    });

    // Keyboard navigation
    bankSearchInput.addEventListener('keydown', function (e) {
        const visibleOptions = Array.from(bankOptions).filter(opt => opt.style.display !== 'none');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (visibleOptions.length > 0) {
                visibleOptions[0].focus();
            }
        } else if (e.key === 'Escape') {
            bankDropdown.classList.add('hidden');
            bankDropdownIcon.style.transform = 'rotate(0deg)';
            bankSearchInput.value = '';
        }
    });
}

// Run init even if this script is loaded after DOMContentLoaded.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBankDropdown);
} else {
    initBankDropdown();
}

// Close the top-level DOMContentLoaded handler that wraps the referral page.
});
