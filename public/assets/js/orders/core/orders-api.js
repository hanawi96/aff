/**
 * Orders API Module
 * 
 * Handles all API calls for orders:
 * - Load tax rate
 * - Load packaging config
 * - Load orders data
 * 
 * Dependencies:
 * - CONFIG.API_URL (from config.js)
 * - COST_CONSTANTS (from orders.js)
 * - packagingConfig (from orders.js)
 * - allOrdersData, filteredOrdersData (from orders.js)
 * 
 * Created: 2026-01-15
 * Extracted from: orders.js
 */

(function() {
    'use strict';

    // Export functions to global namespace
    window.OrdersModules.api = {
        loadCurrentTaxRate,
        loadPackagingConfig,
        loadOrdersData
    };

    /**
     * Load current tax rate from API
     */
    async function loadCurrentTaxRate() {
        try {
            const CONFIG = window.CONFIG || {};
            if (!CONFIG.API_URL) {
                throw new Error('CONFIG.API_URL not defined');
            }
            const response = await fetch(`${CONFIG.API_URL}?action=getCurrentTaxRate&timestamp=${Date.now()}`);
            const data = await response.json();
            if (data.success && data.taxRate) {
                window.COST_CONSTANTS.TAX_RATE = data.taxRate;
                console.log(`✅ Tax rate loaded: ${(data.taxRate * 100).toFixed(1)}%`);
            }
        } catch (error) {
            console.warn('⚠️ Could not load tax rate, using default 1.5%');
        }
    }

    /**
     * Load packaging config from database
     */
    async function loadPackagingConfig() {
        try {
            const CONFIG = window.CONFIG || {};
            if (!CONFIG.API_URL) {
                throw new Error('CONFIG.API_URL not defined');
            }
            const response = await fetch(`${CONFIG.API_URL}?action=getPackagingConfig&timestamp=${Date.now()}`);
            const data = await response.json();

            if (data.success && data.config) {
                window.packagingConfig = data.config;
                console.log('✅ Packaging config loaded:', window.packagingConfig);
            }
        } catch (error) {
            console.error('❌ Error loading packaging config:', error);
        }
    }

    /**
     * Load orders data from API
     */
    async function loadOrdersData() {
        try {
            const CONFIG = window.CONFIG || {};
            if (!CONFIG.API_URL) {
                throw new Error('CONFIG.API_URL not defined');
            }
            
            window.showLoading();

            const response = await fetch(`${CONFIG.API_URL}?action=getRecentOrders&limit=1000&timestamp=${Date.now()}`);

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            console.log('📊 Received orders data:', data);

            if (data.success) {
                window.allOrdersData = data.orders || [];
                window.filteredOrdersData = [...window.allOrdersData];

                // Apply default sorting (newest first)
                window.applySorting();
                window.updateDateSortIcon();
                window.updateAmountSortIcon();

                window.updateStats();
                window.renderOrdersTable();
                window.hideLoading();
            } else {
                throw new Error(data.error || 'Failed to load data');
            }

        } catch (error) {
            console.error('❌ Error loading orders data:', error);
            window.hideLoading();
            window.showError('Không thể tải dữ liệu. Vui lòng thử lại sau.');
        }
    }

    console.log('✅ OrdersModules.api loaded');
})();
