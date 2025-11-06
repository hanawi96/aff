// Form handling and submission
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('referralForm');
    const successMessage = document.getElementById('successMessage');

    // Add smooth animations
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('transform', 'scale-105');
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.classList.remove('transform', 'scale-105');
        });
    });

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        
        // Show loading state
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Đang gửi...';
        submitButton.disabled = true;
        
        try {
            // Collect form data
            const formData = new FormData(form);
            const data = {};
            
            for (let [key, value] of formData.entries()) {
                data[key] = value;
            }
            
            // Add timestamp
            data.timestamp = new Date().toLocaleString('vi-VN');
            
            // Send to Google Apps Script
            // Thay YOUR_WEB_APP_URL bằng URL từ Google Apps Script deployment
            const GOOGLE_SCRIPT_URL = 'YOUR_WEB_APP_URL';
            
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                // Show success message
                form.style.display = 'none';
                successMessage.classList.remove('hidden');
                successMessage.scrollIntoView({ behavior: 'smooth' });
                
                // Add celebration animation
                createCelebration();
            } else {
                throw new Error('Submission failed');
            }
            
        } catch (error) {
            console.error('Error:', error);
            alert('Có lỗi xảy ra khi gửi form. Vui lòng thử lại sau!');
        } finally {
            // Reset button
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
        }
    });

    // Form validation enhancements
    const requiredFields = form.querySelectorAll('[required]');
    requiredFields.forEach(field => {
        field.addEventListener('blur', function() {
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
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) {
                value = value.slice(0, 11);
            }
            e.target.value = value;
        });
    }

    // Celebration animation
    function createCelebration() {
        const colors = ['#f8b4cb', '#a8d8ea', '#d4a5d4'];
        
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.style.position = 'fixed';
                confetti.style.left = Math.random() * 100 + 'vw';
                confetti.style.top = '-10px';
                confetti.style.width = '10px';
                confetti.style.height = '10px';
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.borderRadius = '50%';
                confetti.style.pointerEvents = 'none';
                confetti.style.zIndex = '9999';
                confetti.style.animation = 'fall 3s linear forwards';
                
                document.body.appendChild(confetti);
                
                setTimeout(() => {
                    confetti.remove();
                }, 3000);
            }, i * 50);
        }
    }

    // Add CSS for confetti animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fall {
            0% {
                transform: translateY(-100vh) rotate(0deg);
                opacity: 1;
            }
            100% {
                transform: translateY(100vh) rotate(360deg);
                opacity: 0;
            }
        }
        
        .form-container {
            animation: slideInUp 0.6s ease-out;
        }
        
        @keyframes slideInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
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