// Auth Check - Include this in every admin page
(function() {
    'use strict';

    // Configuration
    // Use global CONFIG from config.js to keep API endpoint consistent
    // across local and Cloudflare Pages environments.
    const API_URL = (
        typeof CONFIG !== 'undefined' && CONFIG.API_URL
    ) || (
        'https://ctv-api.yendev96.workers.dev'
    );

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
    console.log('   API URL:', API_URL);
    
    if (!sessionToken) {
        console.log('❌ No token, redirecting to login');
        // No token, redirect to login
        window.location.href = getLoginPath();
        return;
    }

    // Verify session with server
    console.log('🔍 Verifying session with server...');
    fetch(`${API_URL}?action=verifySession`, {
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

            // Expose currentUser globally so other scripts can use it
            window.currentUser = data.user;

            // Add logout button if not exists
            addLogoutButton();
        }
    })
    .catch(error => {
        console.error('❌ Auth check failed:', error);
        // Lỗi mạng/CORS — không xóa session, tránh bắt đăng nhập lại oan
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
            await fetch(`${API_URL}?action=logout`, {
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

    // Số đơn đã đủ 10 ngày kể từ ngày gửi mà chưa xuất HĐĐT.
    // Cache 60 giây để đổi trang admin không gọi lại API. force=true bỏ cache
    // và gộp nhiều lần gọi liên tiếp (xuất hàng loạt) thành một request.
    const INV_DUE_BADGE_KEY = 'inv_due_count_v1';
    const INV_DUE_BADGE_TTL = 60000;
    let _invDueBadgeTimer = null;

    function paintInvoiceDueBadge(count) {
        const link = document.querySelector('a[href="invoices.html"]');
        if (!link) return;
        const n = Number(count) || 0;
        const label = link.querySelector('span');
        let badge = link.querySelector('[data-inv-due-badge]');
        if (n <= 0) {
            if (badge) badge.remove();
            link.style.paddingRight = '';
            if (label) label.style.whiteSpace = '';
            return;
        }
        if (getComputedStyle(link).position === 'static') link.style.position = 'relative';
        link.style.paddingRight = '2.35rem';
        if (label) label.style.whiteSpace = 'nowrap';
        if (!document.getElementById('inv-due-badge-style')) {
            const style = document.createElement('style');
            style.id = 'inv-due-badge-style';
            style.textContent = '@keyframes invDueNavPulse{0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.5)}50%{box-shadow:0 0 0 4px rgba(16,185,129,0)}}';
            document.head.appendChild(style);
        }
        if (!badge) {
            badge = document.createElement('span');
            badge.setAttribute('data-inv-due-badge', '1');
            badge.style.cssText = 'position:absolute;right:8px;top:50%;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;min-width:1.25rem;height:1.25rem;padding:0 5px;border-radius:999px;background:#10b981;color:#fff;font-size:11px;font-weight:700;line-height:1;animation:invDueNavPulse 1.8s ease-in-out infinite;';
            link.appendChild(badge);
        }
        badge.textContent = n > 999 ? '999+' : String(n);
        badge.title = n + ' hóa đơn đã đến hạn xuất';
    }

    function loadInvoiceDueBadge(force) {
        if (!document.querySelector('a[href="invoices.html"]')) return;
        if (!force) {
            try {
                const cached = JSON.parse(sessionStorage.getItem(INV_DUE_BADGE_KEY) || 'null');
                if (cached && Number.isFinite(Number(cached.count)) && Date.now() - Number(cached.at) < INV_DUE_BADGE_TTL) {
                    paintInvoiceDueBadge(cached.count);
                    return;
                }
            } catch (e) { /* cache hỏng thì đếm lại */ }
        }
        fetch(`${API_URL}?action=getDueInvoiceCount&timestamp=${Date.now()}`)
            .then((res) => res.json())
            .then((data) => {
                if (!data || data.success !== true || !Number.isFinite(Number(data.count))) return;
                const count = Number(data.count);
                try {
                    sessionStorage.setItem(INV_DUE_BADGE_KEY, JSON.stringify({ count, at: Date.now() }));
                } catch (e) { /* trình duyệt chặn storage */ }
                paintInvoiceDueBadge(count);
            })
            .catch(() => {});
    }

    function refreshInvoiceDueBadge(force) {
        if (!document.querySelector('a[href="invoices.html"]')) return;
        if (force) {
            clearTimeout(_invDueBadgeTimer);
            _invDueBadgeTimer = setTimeout(() => loadInvoiceDueBadge(true), 400);
            return;
        }
        loadInvoiceDueBadge(false);
    }

    window.refreshInvoiceDueBadge = refreshInvoiceDueBadge;
    refreshInvoiceDueBadge(false);
})();
