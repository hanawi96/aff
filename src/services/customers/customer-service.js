import { jsonResponse } from '../../utils/response.js';

// Get all customers (virtual - aggregated from orders)
export async function getAllCustomers(env, corsHeaders) {
    try {
        const { results: customers } = await env.DB.prepare(`
            SELECT 
                customer_phone as phone,
                MAX(customer_name) as name,
                MAX(address) as address,
                MAX(province_id) as province_id,
                MAX(province_name) as province_name,
                COUNT(*) as total_orders,
                SUM(total_amount) as total_spent,
                MAX(order_date) as last_order_date,
                MIN(order_date) as first_order_date,
                GROUP_CONCAT(DISTINCT referral_code) as ctv_codes
            FROM orders
            WHERE customer_phone IS NOT NULL AND customer_phone != ''
            GROUP BY customer_phone
            ORDER BY total_spent DESC
        `).all();

        // Calculate additional metrics for each customer
        const enrichedCustomers = customers.map(customer => {
            const daysSinceLastOrder = customer.last_order_date
                ? Math.floor((Date.now() - new Date(customer.last_order_date).getTime()) / (1000 * 60 * 60 * 24))
                : null;

            const daysSinceFirstOrder = customer.first_order_date
                ? Math.floor((Date.now() - new Date(customer.first_order_date).getTime()) / (1000 * 60 * 60 * 24))
                : null;

            // Classify customer
            let segment = 'New';
            if (customer.total_orders >= 5) {
                segment = 'VIP';
            } else if (customer.total_orders >= 2) {
                segment = 'Regular';
            }

            // Check if at risk or churned
            if (daysSinceLastOrder > 90) {
                segment = 'Churned';
            } else if (daysSinceLastOrder > 60) {
                segment = 'At Risk';
            }

            return {
                ...customer,
                avg_order_value: customer.total_spent / customer.total_orders,
                days_since_last_order: daysSinceLastOrder,
                days_since_first_order: daysSinceFirstOrder,
                segment: segment
            };
        });

        console.log('📊 getAllCustomers: Total customers =', enrichedCustomers.length);
        
        return jsonResponse({
            success: true,
            customers: enrichedCustomers,
            total: enrichedCustomers.length
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting customers:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Quick check if customer is new or returning (lightweight query)
export async function checkCustomer(phone, env, corsHeaders) {
    try {
        console.log('checkCustomer called with phone:', phone);
        
        if (!phone || phone.trim() === '') {
            console.log('Phone is empty or null');
            return jsonResponse({
                success: false,
                error: 'Phone number is required'
            }, 400, corsHeaders);
        }

        // Simple count query - very fast
        const result = await env.DB.prepare(`
            SELECT COUNT(*) as order_count
            FROM orders
            WHERE customer_phone = ?
        `).bind(phone).first();

        const orderCount = result?.order_count || 0;
        console.log('Order count for phone', phone, ':', orderCount);

        return jsonResponse({
            success: true,
            isNew: orderCount === 0,
            orderCount: orderCount
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error checking customer:', error);
        return jsonResponse({
            success: false,
            error: 'Internal server error',
            details: error.message
        }, 500, corsHeaders);
    }
}

// Get customer detail with order history
export async function getCustomerDetail(phone, env, corsHeaders) {
    try {
        if (!phone) {
            return jsonResponse({
                success: false,
                error: 'Phone number is required'
            }, 400, corsHeaders);
        }

        // Get customer summary - use total_amount column
        const summary = await env.DB.prepare(`
            SELECT 
                customer_phone as phone,
                MAX(customer_name) as name,
                MAX(address) as address,
                COUNT(*) as total_orders,
                SUM(total_amount) as total_spent,
                MAX(order_date) as last_order_date,
                MIN(order_date) as first_order_date,
                GROUP_CONCAT(DISTINCT referral_code) as ctv_codes
            FROM orders
            WHERE customer_phone = ?
            GROUP BY customer_phone
        `).bind(phone).first();

        if (!summary) {
            return jsonResponse({
                success: false,
                error: 'Customer not found'
            }, 404, corsHeaders);
        }

        // Get order history - use total_amount column and include address fields
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                id,
                order_id,
                order_date,
                total_amount,
                status,
                referral_code,
                commission,
                products,
                shipping_fee,
                address,
                province_id,
                district_id,
                ward_id,
                street_address
            FROM orders 
            WHERE customer_phone = ? 
            ORDER BY order_date DESC
        `).bind(phone).all();

        // Calculate metrics
        const daysSinceLastOrder = summary.last_order_date
            ? Math.floor((Date.now() - new Date(summary.last_order_date).getTime()) / (1000 * 60 * 60 * 24))
            : null;

        const daysSinceFirstOrder = summary.first_order_date
            ? Math.floor((Date.now() - new Date(summary.first_order_date).getTime()) / (1000 * 60 * 60 * 24))
            : null;

        // Classify customer
        let segment = 'New';
        if (summary.total_orders >= 5) {
            segment = 'VIP';
        } else if (summary.total_orders >= 2) {
            segment = 'Regular';
        }

        if (daysSinceLastOrder > 90) {
            segment = 'Churned';
        } else if (daysSinceLastOrder > 60) {
            segment = 'At Risk';
        }

        const customerDetail = {
            ...summary,
            avg_order_value: summary.total_spent / summary.total_orders,
            days_since_last_order: daysSinceLastOrder,
            days_since_first_order: daysSinceFirstOrder,
            segment: segment,
            orders: orders
        };

        return jsonResponse({
            success: true,
            customer: customerDetail
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting customer detail:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Search customers
export async function searchCustomers(query, env, corsHeaders) {
    try {
        if (!query || query.trim() === '') {
            return await getAllCustomers(env, corsHeaders);
        }

        const searchTerm = `%${query.trim()}%`;

        const { results: customers } = await env.DB.prepare(`
            SELECT 
                customer_phone as phone,
                customer_name as name,
                MAX(address) as address,
                COUNT(*) as total_orders,
                SUM(total_amount) as total_spent,
                MAX(order_date) as last_order_date,
                MIN(order_date) as first_order_date,
                GROUP_CONCAT(DISTINCT referral_code) as ctv_codes
            FROM orders
            WHERE (customer_name LIKE ? OR customer_phone LIKE ?)
            AND customer_phone IS NOT NULL AND customer_phone != ''
            GROUP BY customer_phone
            ORDER BY total_spent DESC
        `).bind(searchTerm, searchTerm).all();

        // Enrich customer data
        const enrichedCustomers = customers.map(customer => {
            const daysSinceLastOrder = customer.last_order_date
                ? Math.floor((Date.now() - new Date(customer.last_order_date).getTime()) / (1000 * 60 * 60 * 24))
                : null;

            let segment = 'New';
            if (customer.total_orders >= 5) {
                segment = 'VIP';
            } else if (customer.total_orders >= 2) {
                segment = 'Regular';
            }

            if (daysSinceLastOrder > 90) {
                segment = 'Churned';
            } else if (daysSinceLastOrder > 60) {
                segment = 'At Risk';
            }

            return {
                ...customer,
                avg_order_value: customer.total_spent / customer.total_orders,
                days_since_last_order: daysSinceLastOrder,
                segment: segment
            };
        });

        return jsonResponse({
            success: true,
            customers: enrichedCustomers
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error searching customers:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
