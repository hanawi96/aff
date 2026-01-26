// Auth Check - Include this in every admin page
(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        API_URL: window.location.port === '5500' ? 'http://localhost:8787' : ''
    };

    // Helper function to get correct login path
    function getLoginPath() {
        // Check if we're in /public/ path (local) or root (production)
        const currentPath = window.location.pathname;
        console.log('📍 Current path:', currentPath);
        
        let loginPath;
        if (currentPath.includes('/public/')) {
            loginPath = '../login.html';
        } else {
            loginPath = '/login.html';
        }
        
        console.log('🔗 Login path:', loginPath);
        return loginPath;
    }

    // Check if session token exists
    const sessionToken = localStorage.getItem('session_token');
    
    console.log('🔐 Auth check starting...');
    console.log('   Session token:', sessionToken ? 'EXISTS' : 'MISSING');
    console.log('   API URL:', CONFIG.API_URL);
    
    if (!sessionToken) {
        console.log('❌ No token, redirecting to login');
        // No token, redirect to login
        window.location.href = getLoginPath();
        return;
    }

    // Verify session with server
    console.log('🔍 Verifying session with server...');
    fetch(`${CONFIG.API_URL}?action=verifySession`, {
        headers: {
            'Authorization': `Bearer ${sessionToken}`
        }
    })
    .then(res => {
        console.log('📡 Response status:', res.status);
        return res.json();
    })
    .then(data => {
        console.log('📦 Response data:', data);
        if (!data.success) {
            console.log('❌ Session invalid, redirecting to login');
            // Invalid session, clear and redirect
            localStorage.removeItem('session_token');
            localStorage.removeItem('user_info');
            window.location.href = getLoginPath();
        } else {
            console.log('✅ Session valid!');
            // Session valid, update user info
            localStorage.setItem('user_info', JSON.stringify(data.user));
            
            // Add logout button if not exists
            addLogoutButton();
        }
    })
    .catch(error => {
        console.error('❌ Auth check failed:', error);
        // On error, redirect to login
        localStorage.removeItem('session_token');
        localStorage.removeItem('user_info');
        window.location.href = getLoginPath();
    });

    // Update user profile in sidebar
    function addLogoutButton() {
        const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
        
        // Update avatar initials
        const avatar = document.getElementById('userAvatar');
        if (avatar) {
            const fullName = userInfo.full_name || 'Administrator';
            const words = fullName.trim().split(/\s+/);
            let initials;
            
            if (words.length >= 2) {
                // Lấy chữ cái đầu của 2 từ đầu tiên
                initials = (words[0][0] + words[1][0]).toUpperCase();
            } else {
                // Nếu chỉ có 1 từ, lấy 2 chữ cái đầu
                initials = fullName.substring(0, 2).toUpperCase();
            }
            
            avatar.textContent = initials;
        }
        
        // Update full name
        const fullName = document.getElementById('userFullName');
        if (fullName) {
            fullName.textContent = userInfo.full_name || 'Administrator';
        }
        
        // Update username
        const username = document.getElementById('userUsername');
        if (username) {
            username.textContent = userInfo.username || 'admin';
        }
    }

    // Logout function
    window.logout = async function() {
        if (!confirm('Bạn có chắc muốn đăng xuất?')) return;

        const sessionToken = localStorage.getItem('session_token');
        
        try {
            await fetch(`${CONFIG.API_URL}?action=logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }

        // Clear local storage
        localStorage.removeItem('session_token');
        localStorage.removeItem('user_info');
        
        // Redirect to login
        window.location.href = getLoginPath();
    };
})();
