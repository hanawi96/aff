/**
 * CTV Debug Panel
 * Panel nhỏ để kiểm tra CTV tracking
 */

import { getCTVCookie, getCTVInfoForOrder, clearCTVCookie, calculateCommission, debugCTVTracking } from '../utils/ctv-tracking.js';

export class CTVDebugPanel {
    constructor() {
        this.isVisible = false;
        this.ctvInfo = null;
        this.init();
    }

    /**
     * Initialize panel
     */
    init() {
        this.createPanel();
        this.setupEventListeners();
        this.updateInfo();
        
        // Auto-update every 2 seconds
        setInterval(() => {
            if (this.isVisible) {
                this.updateInfo();
            }
        }, 2000);
    }

    /**
     * Create panel HTML
     */
    createPanel() {
        // Create main panel
        const panel = document.createElement('div');
        panel.id = 'ctvDebugPanel';
        panel.className = 'ctv-debug-panel hidden';
        panel.innerHTML = `
            <div class="ctv-debug-header">
                <div class="ctv-debug-title">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem;">
                        <path fill-rule="evenodd" d="M2.25 13.5a8.25 8.25 0 0 1 8.25-8.25.75.75 0 0 1 .75.75v6.75H18a.75.75 0 0 1 .75.75 8.25 8.25 0 0 1-16.5 0Z" clip-rule="evenodd" />
                        <path fill-rule="evenodd" d="M12.75 3a.75.75 0 0 1 .75-.75 8.25 8.25 0 0 1 8.25 8.25.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75V3Z" clip-rule="evenodd" />
                    </svg>
                    CTV Tracking Debug
                </div>
                <button class="ctv-debug-close" id="ctvDebugClose">×</button>
            </div>
            <div class="ctv-debug-body">
                <!-- Cookie Status -->
                <div class="ctv-debug-section">
                    <div class="ctv-debug-label">🍪 Cookie Status:</div>
                    <div class="ctv-debug-value" id="ctvCookieStatus">Checking...</div>
                </div>

                <!-- CTV Info -->
                <div class="ctv-debug-section">
                    <div class="ctv-debug-label">👤 CTV Info:</div>
                    <div class="ctv-debug-value" id="ctvInfo">Loading...</div>
                </div>

                <!-- Commission Rate -->
                <div class="ctv-debug-section">
                    <div class="ctv-debug-label">💰 Tỷ lệ hoa hồng:</div>
                    <div class="ctv-debug-value" id="ctvRate">-</div>
                </div>

                <!-- Test Commission -->
                <div class="ctv-debug-section">
                    <div class="ctv-debug-label">🧪 Test hoa hồng (500k - 30k ship):</div>
                    <div class="ctv-debug-value" id="ctvTestCommission">-</div>
                </div>

                <!-- Cookie Expiry -->
                <div class="ctv-debug-section">
                    <div class="ctv-debug-label">⏰ Cookie expires:</div>
                    <div class="ctv-debug-value" id="ctvExpiry">-</div>
                </div>

                <!-- Actions -->
                <div class="ctv-debug-actions">
                    <button class="ctv-debug-btn ctv-debug-btn-refresh" id="ctvRefresh">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem;">
                            <path fill-rule="evenodd" d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm15.408 3.352a.75.75 0 0 0-.919.53 7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.984a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 15.059-4.035.75.75 0 0 0-.53-.918Z" clip-rule="evenodd" />
                        </svg>
                        Refresh
                    </button>
                    <button class="ctv-debug-btn ctv-debug-btn-clear" id="ctvClear">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem;">
                            <path fill-rule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clip-rule="evenodd" />
                        </svg>
                        Clear Cookie
                    </button>
                    <button class="ctv-debug-btn ctv-debug-btn-console" id="ctvConsole">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem;">
                            <path fill-rule="evenodd" d="M2.25 6a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V6Zm3.97.97a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1 0 1.06l-2.25 2.25a.75.75 0 0 1-1.06-1.06l1.72-1.72-1.72-1.72a.75.75 0 0 1 0-1.06Zm4.28 4.28a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" clip-rule="evenodd" />
                        </svg>
                        Console Log
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // Create toggle button (SEPARATE from panel)
        const toggleBtn = document.createElement('div');
        toggleBtn.id = 'ctvDebugToggle';
        toggleBtn.className = 'ctv-debug-toggle';
        toggleBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path fill-rule="evenodd" d="M2.25 13.5a8.25 8.25 0 0 1 8.25-8.25.75.75 0 0 1 .75.75v6.75H18a.75.75 0 0 1 .75.75 8.25 8.25 0 0 1-16.5 0Z" clip-rule="evenodd" />
                <path fill-rule="evenodd" d="M12.75 3a.75.75 0 0 1 .75-.75 8.25 8.25 0 0 1 8.25 8.25.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75V3Z" clip-rule="evenodd" />
            </svg>
            CTV
        `;
        
        document.body.appendChild(toggleBtn);
        
        console.log('✅ CTV Debug Panel created');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Toggle button
        document.getElementById('ctvDebugToggle').onclick = () => this.toggle();
        
        // Close button
        document.getElementById('ctvDebugClose').onclick = () => this.hide();
        
        // Refresh button
        document.getElementById('ctvRefresh').onclick = () => this.updateInfo();
        
        // Clear button
        document.getElementById('ctvClear').onclick = () => this.clearCookie();
        
        // Console log button
        document.getElementById('ctvConsole').onclick = () => debugCTVTracking();
    }

    /**
     * Update panel info
     */
    async updateInfo() {
        console.log('🔄 [CTV Panel] Starting updateInfo...');
        
        // Get cookie
        const cookie = getCTVCookie();
        console.log('🍪 [CTV Panel] Cookie value:', cookie);
        
        const cookieStatus = document.getElementById('ctvCookieStatus');
        
        if (cookie) {
            cookieStatus.innerHTML = `<span class="ctv-status-active">✅ Active: ${cookie}</span>`;
            console.log('✅ [CTV Panel] Cookie is active');
        } else {
            cookieStatus.innerHTML = `<span class="ctv-status-inactive">❌ No cookie</span>`;
            console.log('❌ [CTV Panel] No cookie found');
        }

        // Get CTV info
        console.log('📞 [CTV Panel] Calling getCTVInfoForOrder...');
        const ctvInfo = await getCTVInfoForOrder();
        console.log('📦 [CTV Panel] CTV Info result:', ctvInfo);
        
        const ctvInfoEl = document.getElementById('ctvInfo');
        const ctvRateEl = document.getElementById('ctvRate');
        const ctvTestCommissionEl = document.getElementById('ctvTestCommission');
        
        if (ctvInfo) {
            console.log('✅ [CTV Panel] CTV Info found:', {
                name: ctvInfo.ctvName,
                phone: ctvInfo.ctvPhone,
                code: ctvInfo.referralCode,
                rate: ctvInfo.commissionRate
            });
            
            this.ctvInfo = ctvInfo;
            ctvInfoEl.innerHTML = `
                <div class="ctv-info-detail">
                    <strong>${ctvInfo.ctvName}</strong><br>
                    <small>📞 ${ctvInfo.ctvPhone}</small><br>
                    <small>🔗 ${ctvInfo.referralCode}</small>
                </div>
            `;
            
            const ratePercent = (ctvInfo.commissionRate * 100).toFixed(1);
            ctvRateEl.innerHTML = `<span class="ctv-rate">${ratePercent}%</span>`;
            
            // Test commission calculation
            const testTotal = 500000;
            const testShipping = 30000;
            const testCommission = calculateCommission(testTotal, testShipping, ctvInfo.commissionRate);
            console.log('💰 [CTV Panel] Test commission:', {
                total: testTotal,
                shipping: testShipping,
                rate: ctvInfo.commissionRate,
                commission: testCommission
            });
            ctvTestCommissionEl.innerHTML = `<span class="ctv-commission">${testCommission.toLocaleString('vi-VN')}đ</span>`;
        } else {
            console.log('❌ [CTV Panel] No CTV info found');
            this.ctvInfo = null;
            ctvInfoEl.innerHTML = `<span class="ctv-status-inactive">Không có CTV</span>`;
            ctvRateEl.innerHTML = '-';
            ctvTestCommissionEl.innerHTML = '-';
        }

        // Cookie expiry (estimate 7 days from now if cookie exists)
        const expiryEl = document.getElementById('ctvExpiry');
        if (cookie) {
            // We can't get exact expiry from cookie, so show estimate
            expiryEl.innerHTML = `<span class="ctv-expiry">~7 ngày (estimate)</span>`;
        } else {
            expiryEl.innerHTML = '-';
        }
        
        console.log('✅ [CTV Panel] updateInfo completed');
    }

    /**
     * Clear cookie
     */
    clearCookie() {
        if (confirm('Xóa CTV cookie? Bạn sẽ cần click vào link CTV lại.')) {
            clearCTVCookie();
            this.updateInfo();
            alert('✅ Đã xóa cookie!');
        }
    }

    /**
     * Toggle panel
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Show panel
     */
    show() {
        const panel = document.getElementById('ctvDebugPanel');
        const toggle = document.getElementById('ctvDebugToggle');
        
        panel.classList.remove('hidden');
        if (toggle) {
            toggle.style.opacity = '0';
            toggle.style.pointerEvents = 'none';
        }
        
        this.isVisible = true;
        this.updateInfo();
    }

    /**
     * Hide panel
     */
    hide() {
        const panel = document.getElementById('ctvDebugPanel');
        const toggle = document.getElementById('ctvDebugToggle');
        
        panel.classList.add('hidden');
        if (toggle) {
            toggle.style.opacity = '1';
            toggle.style.pointerEvents = 'auto';
        }
        
        this.isVisible = false;
    }
}

// Auto-initialize if in development or has ?debug=ctv in URL
if (window.location.hostname === 'localhost' || 
    window.location.search.includes('debug=ctv') ||
    window.location.search.includes('ref=')) {
    window.ctvDebugPanel = new CTVDebugPanel();
}
