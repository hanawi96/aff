// Custom Slug Modal Handler
let currentReferralCode = null;
let currentCustomSlug = null;

// Initialize custom slug functionality
export function initCustomSlugModal(referralCode, customSlug) {
    currentReferralCode = referralCode;
    currentCustomSlug = customSlug;
    
    // Add button to CTV info section if not exists
    addCustomSlugButton();
}

function addCustomSlugButton() {
    const ctvCodeElement = document.getElementById('ctvCode');
    if (!ctvCodeElement || document.getElementById('customSlugBtn')) return;

    const mount = document.getElementById('customSlugBtnMount');
    const badgesContainer = document.getElementById('ctvMetaBadges') || ctvCodeElement.closest('.flex.flex-wrap');
    const parent = mount || badgesContainer;
    if (!parent) return;

    const button = document.createElement('button');
    button.id = 'customSlugBtn';
    button.type = 'button';
    button.onclick = showCustomSlugModal;
    const label = currentCustomSlug ? 'Đổi link giới thiệu' : 'Tạo / chỉnh sửa link giới thiệu';
    button.title = label;
    button.setAttribute('aria-label', label);
    // Chỉ icon bút — cạnh tiêu đề "Link giới thiệu" (hoặc fallback append vào ctvMetaBadges)
    button.className =
        'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-violet-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50';
    button.innerHTML = `
        <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
    `;

    parent.appendChild(button);
}

function showCustomSlugModal() {
    const modal = document.getElementById('customSlugModal');
    if (!modal) {
        createCustomSlugModal();
    }
    
    // Reset form
    document.getElementById('slugInput').value = currentCustomSlug || '';
    document.getElementById('phoneVerifyInput').value = '';
    document.getElementById('slugError').classList.add('hidden');
    document.getElementById('slugSuccess').classList.add('hidden');
    document.getElementById('phoneVerifyError').classList.add('hidden');
    document.getElementById('slugPreview').textContent = currentCustomSlug || 'yennguyen';
    
    // Focus on slug input
    setTimeout(() => {
        document.getElementById('slugInput').focus();
    }, 100);
    
    // Show modal
    document.getElementById('customSlugModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function createCustomSlugModal() {
    // Use current origin for development, fallback to CONFIG.SHOP_URL for production
    const baseUrl = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
        ? window.location.origin
        : CONFIG.SHOP_URL;
    
    // Extract domain for display (remove http:// or https://)
    const displayDomain = baseUrl.replace(/^https?:\/\//, '');
    
    const currentLink = currentCustomSlug 
        ? `${baseUrl}/?ref=${currentCustomSlug}`
        : `${baseUrl}/?ref=${currentReferralCode}`;
    
    const modalHTML = `
        <div id="customSlugModal" class="hidden fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full transform transition-all">
                <!-- Header -->
                <div class="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-lg font-bold text-white">Tùy Chỉnh Link Giới Thiệu</h2>
                            <p class="text-xs text-indigo-100">Tạo link dễ nhớ, dễ chia sẻ</p>
                        </div>
                    </div>
                    <button onclick="closeCustomSlugModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <!-- Body -->
                <div class="p-6 space-y-4">
                    <!-- Current Link -->
                    <div class="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <p class="text-xs text-gray-600 mb-1">Link hiện tại</p>
                        <p class="text-sm font-mono text-gray-900 break-all">
                            ${currentLink}
                        </p>
                    </div>

                    <!-- Phone Verification -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Xác minh số điện thoại <span class="text-red-500">*</span>
                        </label>
                        <div class="relative">
                            <div class="absolute left-3 top-3 flex items-center pointer-events-none">
                                <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                            </div>
                            <input type="tel" id="phoneVerifyInput" 
                                class="w-full pl-11 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                                placeholder="Nhập số điện thoại đã đăng ký"
                                maxlength="11">
                        </div>
                        
                        <!-- Phone Error -->
                        <div id="phoneVerifyError" class="hidden mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p class="text-sm text-red-700 flex items-center gap-2">
                                <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                                </svg>
                                <span id="phoneVerifyErrorText">Số điện thoại không chính xác</span>
                            </p>
                        </div>
                        
                        <div class="mt-2 text-xs text-gray-600">
                            <p>🔒 Nhập số điện thoại đã đăng ký để xác minh danh tính</p>
                        </div>
                    </div>

                    <!-- Input with Domain Prefix -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Link giới thiệu của bạn <span class="text-red-500">*</span>
                        </label>
                        <div class="relative flex items-center border-2 border-gray-300 rounded-xl focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200 transition-all overflow-hidden">
                            <!-- Domain Prefix (Read-only) -->
                            <div class="flex items-center bg-gray-100 px-4 py-3 border-r border-gray-300">
                                <svg class="w-4 h-4 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                <span id="domainPrefix" class="text-sm font-mono text-gray-600 whitespace-nowrap">${displayDomain}/?ref=</span>
                            </div>
                            <!-- User Input -->
                            <input type="text" id="slugInput" 
                                class="flex-1 px-4 py-3 border-0 focus:outline-none focus:ring-0"
                                placeholder="yennguyen"
                                oninput="validateSlugInput(this.value)"
                                maxlength="20">
                            <div id="slugCheckIcon" class="hidden absolute right-3"></div>
                        </div>
                        
                        <!-- Error Message -->
                        <div id="slugError" class="hidden mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p class="text-sm text-red-700 flex items-center gap-2">
                                <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                                </svg>
                                <span id="slugErrorText"></span>
                            </p>
                        </div>
                        
                        <!-- Success Message -->
                        <div id="slugSuccess" class="hidden mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p class="text-sm text-green-700 flex items-center gap-2">
                                <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                                </svg>
                                <span>Link này khả dụng!</span>
                            </p>
                        </div>
                        
                        <!-- Rules -->
                        <div class="mt-2 text-xs text-gray-600 space-y-1">
                            <p>✓ Từ 4-20 ký tự</p>
                            <p>✓ Chỉ dùng chữ thường, số và dấu gạch ngang (a-z, 0-9, -)</p>
                            <p>✓ Không bắt đầu/kết thúc bằng dấu gạch ngang</p>
                            <p class="text-orange-600 font-semibold">⚠️ Chỉ được đổi tối đa 3 lần/năm</p>
                        </div>
                        
                        <!-- Live Preview -->
                        <div class="mt-3 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                            <div class="flex items-start gap-2">
                                <svg class="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <div class="flex-1 min-w-0">
                                    <p class="text-xs text-gray-600 mb-1">Xem trước link:</p>
                                    <p class="text-sm font-mono font-semibold break-all">
                                        <span class="text-indigo-600">${displayDomain}/?ref=</span><span id="slugPreview" class="text-purple-600">yennguyen</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="px-6 pb-6 flex gap-3">
                    <button onclick="closeCustomSlugModal()" 
                        class="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors">
                        Hủy
                    </button>
                    <button onclick="submitCustomSlug()" id="submitSlugBtn"
                        class="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed">
                        <span id="submitSlugText">Lưu thay đổi</span>
                        <span id="submitSlugLoading" class="hidden">
                            <svg class="animate-spin h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

window.closeCustomSlugModal = function() {
    document.getElementById('customSlugModal').classList.add('hidden');
    document.body.style.overflow = '';
};

let validateTimeout;
window.validateSlugInput = function(value) {
    const slug = value.toLowerCase().trim();
    const preview = document.getElementById('slugPreview');
    const errorDiv = document.getElementById('slugError');
    const successDiv = document.getElementById('slugSuccess');
    const submitBtn = document.getElementById('submitSlugBtn');
    
    // Update preview with placeholder if empty
    preview.textContent = slug || 'yennguyen';
    preview.className = slug ? 'text-purple-600' : 'text-gray-400';
    
    if (!slug) {
        errorDiv.classList.add('hidden');
        successDiv.classList.add('hidden');
        submitBtn.disabled = true;
        return;
    }
    
    // Clear previous timeout
    clearTimeout(validateTimeout);
    
    // Debounce validation
    validateTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`${CONFIG.API_URL}?action=checkSlugAvailability`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    slug: slug,
                    referralCode: currentReferralCode 
                })
            });
            
            const result = await response.json();
            
            if (result.success && result.available) {
                errorDiv.classList.add('hidden');
                successDiv.classList.remove('hidden');
                submitBtn.disabled = false;
            } else {
                errorDiv.classList.remove('hidden');
                successDiv.classList.add('hidden');
                document.getElementById('slugErrorText').textContent = result.error || 'Slug không khả dụng';
                submitBtn.disabled = true;
            }
        } catch (error) {
            console.error('Validation error:', error);
            submitBtn.disabled = true;
        }
    }, 500);
};

window.submitCustomSlug = async function() {
    const slug = document.getElementById('slugInput').value.toLowerCase().trim();
    const phone = document.getElementById('phoneVerifyInput').value.trim();
    const submitBtn = document.getElementById('submitSlugBtn');
    const submitText = document.getElementById('submitSlugText');
    const submitLoading = document.getElementById('submitSlugLoading');
    const phoneError = document.getElementById('phoneVerifyError');
    const phoneErrorText = document.getElementById('phoneVerifyErrorText');
    
    // Validate phone
    if (!phone) {
        phoneError.classList.remove('hidden');
        phoneErrorText.textContent = 'Vui lòng nhập số điện thoại';
        return;
    }
    
    if (!/^0?\d{9,10}$/.test(phone)) {
        phoneError.classList.remove('hidden');
        phoneErrorText.textContent = 'Số điện thoại không hợp lệ (10-11 số)';
        return;
    }
    
    if (!slug) {
        document.getElementById('slugError').classList.remove('hidden');
        document.getElementById('slugErrorText').textContent = 'Vui lòng nhập link tùy chỉnh';
        return;
    }
    
    // Hide errors
    phoneError.classList.add('hidden');
    
    // Show loading
    submitBtn.disabled = true;
    submitText.classList.add('hidden');
    submitLoading.classList.remove('hidden');
    
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=updateCustomSlug`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                referralCode: currentReferralCode,
                newSlug: slug,
                phoneVerify: phone
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Update current slug
            currentCustomSlug = result.customSlug;
            
            // Show success message
            alert(`✅ Đã cập nhật link thành công!\n\nLink mới: ${result.newUrl}\n\nSố lần đổi còn lại: ${result.changesRemaining}/3`);
            
            // Close modal
            closeCustomSlugModal();
            
            // Reload page to show new link
            window.location.reload();
        } else {
            // Check if it's phone verification error
            if (result.error && result.error.includes('điện thoại')) {
                phoneError.classList.remove('hidden');
                phoneErrorText.textContent = result.error;
            } else {
                alert('❌ ' + (result.error || 'Có lỗi xảy ra'));
            }
        }
    } catch (error) {
        console.error('Submit error:', error);
        alert('❌ Có lỗi xảy ra: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitText.classList.remove('hidden');
        submitLoading.classList.add('hidden');
    }
};
