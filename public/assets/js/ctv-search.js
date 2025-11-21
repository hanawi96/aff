// CTV Search Page - Clean separation of concerns
document.addEventListener('DOMContentLoaded', function () {
    const searchForm = document.getElementById('searchForm');
    const referralCodeInput = document.getElementById('referralCode');
    const searchButton = document.getElementById('searchButton');
    const searchIcon = document.getElementById('searchIcon');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const searchButtonText = document.getElementById('searchButtonText');

    // Form submit handler
    searchForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const input = referralCodeInput.value.trim();
        
        if (!input) {
            alert('Vui lòng nhập mã CTV hoặc số điện thoại');
            return;
        }

        // Show loading state
        setButtonLoading(true);

        try {
            const isPhone = /^0?\d{9,10}$/.test(input);
            const code = isPhone ? input : input.toUpperCase();
            
            // Validate data exists before redirecting
            const isValid = await validateCode(code, isPhone);
            
            if (isValid) {
                // Redirect to results page with code
                window.location.href = `results.html?code=${encodeURIComponent(code)}`;
            } else {
                setButtonLoading(false);
                showError(isPhone 
                    ? `Số điện thoại ${code} chưa có đơn hàng nào. Hãy bắt đầu chia sẻ link! 💪`
                    : `Mã CTV ${code} chưa có đơn hàng nào. Hãy bắt đầu chia sẻ link! 💪`
                );
            }
        } catch (error) {
            setButtonLoading(false);
            showError('Có lỗi xảy ra khi kiểm tra dữ liệu. Vui lòng thử lại.');
            console.error('Search error:', error);
        }
    });

    // Validate if code has orders
    async function validateCode(code, isPhone) {
        const action = isPhone ? 'getCTVOrdersByPhone' : 'getCTVOrders';
        const param = isPhone ? 'phone' : 'referralCode';
        
        try {
            const response = await fetch(`${CONFIG.API_URL}?action=${action}&${param}=${encodeURIComponent(code)}&t=${Date.now()}`);
            const result = await response.json();
            return result.success && result.orders && result.orders.length > 0;
        } catch (error) {
            console.error('Validation error:', error);
            return false;
        }
    }

    // UI helpers
    function setButtonLoading(isLoading) {
        if (isLoading) {
            searchIcon.classList.add('hidden');
            loadingSpinner.classList.remove('hidden');
            searchButtonText.textContent = 'Đang kiểm tra...';
            searchButton.disabled = true;
        } else {
            searchIcon.classList.remove('hidden');
            loadingSpinner.classList.add('hidden');
            searchButtonText.textContent = 'Tra cứu ngay';
            searchButton.disabled = false;
        }
    }

    function showError(message) {
        alert(message);
    }
});
