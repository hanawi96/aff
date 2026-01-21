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
            
            // Always redirect to results page - let it handle empty state
            window.location.href = `results.html?code=${encodeURIComponent(code)}`;
        } catch (error) {
            setButtonLoading(false);
            showError('Có lỗi xảy ra khi kiểm tra dữ liệu. Vui lòng thử lại.');
            console.error('Search error:', error);
        }
    });



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
