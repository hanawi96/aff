// Payment & Commission Management Service
import { jsonResponse } from '../../utils/response.js';

/**
 * Get commissions by month
 * GET ?action=getCommissionsByMonth&month=2025-11
 */
export async function getCommissionsByMonth(month, env, corsHeaders) {
    try {
        if (!month) {
            return jsonResponse({
                success: false,
                error: 'Month parameter is required (format: YYYY-MM)'
            }, 400, corsHeaders);
        }

        // Parse month to get start and end dates
        const [year, monthNum] = month.split('-');
        const startDate = `${year}-${monthNum}-01`;
        const endDate = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
        const endDateStr = `${year}-${monthNum}-${endDate}`;

        // Get all CTVs
        const { results: ctvList } = await env.DB.prepare(`
            SELECT referral_code, full_name, phone, commission_rate, bank_account_number, bank_name
            FROM ctv
            WHERE status != 'Tạm ngưng'
            ORDER BY full_name ASC
        `).all();

        // Get all orders except cancelled ones for this month
        console.log('🔍 Querying orders for:', { month, startDate, endDateStr });
        
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                o.referral_code,
                COUNT(DISTINCT o.id) as order_count,
                SUM(o.commission) as total_commission
            FROM orders o
            WHERE o.status NOT IN ('Đã hủy', 'Hủy')
            AND DATE(o.created_at_unix / 1000, 'unixepoch', 'localtime') >= DATE(?)
            AND DATE(o.created_at_unix / 1000, 'unixepoch', 'localtime') <= DATE(?)
            AND o.referral_code IS NOT NULL
            AND o.referral_code != ''
            GROUP BY o.referral_code
        `).bind(startDate, endDateStr).all();
        
        console.log('📦 Found orders:', orders.length);

        // Get existing payment records for this month
        const { results: payments } = await env.DB.prepare(`
            SELECT *
            FROM commission_payments
            WHERE month = ?
        `).bind(month).all();

        // Create a map of payments by referral_code
        const paymentMap = {};
        payments.forEach(p => {
            paymentMap[p.referral_code] = p;
        });

        // Combine data
        const commissionList = ctvList.map(ctv => {
            const orderData = orders.find(o => o.referral_code === ctv.referral_code);
            const payment = paymentMap[ctv.referral_code];

            const orderCount = orderData ? orderData.order_count : 0;
            const commissionAmount = orderData ? orderData.total_commission : 0;

            return {
                referral_code: ctv.referral_code,
                ctv_name: ctv.full_name,
                phone: ctv.phone,
                commission_rate: ctv.commission_rate,
                bank_account_number: ctv.bank_account_number,
                bank_name: ctv.bank_name,
                order_count: orderCount,
                commission_amount: commissionAmount,
                status: payment ? payment.status : 'pending',
                payment_date: payment ? payment.payment_date : null,
                payment_method: payment ? payment.payment_method : null,
                note: payment ? payment.note : null,
                payment_id: payment ? payment.id : null
            };
        }).filter(item => item.order_count > 0); // Only show CTVs with orders

        // Calculate summary
        const summary = {
            total_ctv: commissionList.length,
            paid_count: commissionList.filter(c => c.status === 'paid').length,
            pending_count: commissionList.filter(c => c.status === 'pending').length,
            total_commission: commissionList.reduce((sum, c) => sum + c.commission_amount, 0),
            paid_amount: commissionList.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.commission_amount, 0),
            pending_amount: commissionList.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.commission_amount, 0)
        };

        return jsonResponse({
            success: true,
            month: month,
            commissions: commissionList,
            summary: summary
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting commissions:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

const PAID_HISTORY_SELECT = `
            SELECT 
                cp.id as payment_id,
                cp.referral_code,
                cp.month as commission_month,
                cp.order_count,
                cp.commission_amount,
                cp.payment_date_unix,
                cp.payment_method,
                cp.note,
                cp.status,
                c.full_name as ctv_name,
                c.phone,
                c.bank_account_number,
                c.bank_name
            FROM commission_payments cp
            LEFT JOIN ctv c ON cp.referral_code = c.referral_code
`;

/**
 * Get paid commission_payment rows (lịch sử thanh toán).
 * - Default: GET ?action=getPaidOrdersByMonth&month=2025-11 (theo tháng kỳ hoa hồng)
 * - Theo ngày thực trả: paymentStartMs & paymentEndMs (unix ms, inclusive)
 * - Tất cả: allPaid=1 (giới hạn 8000 bản ghi mới nhất)
 */
export async function getPaidOrdersByMonth(month, env, corsHeaders, options = {}) {
    try {
        const { paymentStartMs, paymentEndMs, allPaid } = options;

        let payments;

        if (allPaid) {
            const { results } = await env.DB.prepare(`
                ${PAID_HISTORY_SELECT.trim()}
            WHERE cp.status = 'paid'
            ORDER BY cp.payment_date_unix DESC, cp.id DESC
            LIMIT 8000
            `).all();
            payments = results;
        } else if (paymentStartMs != null && paymentEndMs != null &&
            Number.isFinite(paymentStartMs) && Number.isFinite(paymentEndMs)) {
            const { results } = await env.DB.prepare(`
                ${PAID_HISTORY_SELECT.trim()}
            WHERE cp.status = 'paid'
            AND cp.payment_date_unix IS NOT NULL
            AND cp.payment_date_unix >= ?
            AND cp.payment_date_unix <= ?
            ORDER BY cp.payment_date_unix DESC, cp.id DESC
            `).bind(paymentStartMs, paymentEndMs).all();
            payments = results;
        } else {
            if (!month) {
                return jsonResponse({
                    success: false,
                    error: 'Month parameter is required (format: YYYY-MM), or pass paymentStartMs, paymentEndMs, or allPaid=1'
                }, 400, corsHeaders);
            }

            const { results } = await env.DB.prepare(`
                ${PAID_HISTORY_SELECT.trim()}
            WHERE cp.month = ?
            AND cp.status = 'paid'
            ORDER BY cp.payment_date_unix DESC, cp.id DESC
            `).bind(month).all();
            payments = results;
        }

        return jsonResponse({
            success: true,
            month: month || null,
            payments: payments,
            summary: {
                total_payments: payments.length,
                total_orders: payments.reduce((sum, p) => sum + (p.order_count || 0), 0),
                total_amount: payments.reduce((sum, p) => sum + (p.commission_amount || 0), 0)
            }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting paid orders:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Calculate and save commissions for a month
 * POST ?action=calculateCommissions
 * Body: { month: "2025-11" }
 */
export async function calculateCommissions(data, env, corsHeaders) {
    try {
        const { month } = data;

        if (!month) {
            return jsonResponse({
                success: false,
                error: 'Month is required (format: YYYY-MM)'
            }, 400, corsHeaders);
        }

        // Parse month to get start and end dates
        const [year, monthNum] = month.split('-');
        const startDate = `${year}-${monthNum}-01`;
        const endDate = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
        const endDateStr = `${year}-${monthNum}-${endDate}`;

        // Get all orders except cancelled ones for this month grouped by CTV
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                referral_code,
                COUNT(*) as order_count,
                SUM(commission) as total_commission
            FROM orders
            WHERE status NOT IN ('Đã hủy', 'Hủy')
            AND DATE(created_at_unix / 1000, 'unixepoch', 'localtime') >= DATE(?)
            AND DATE(created_at_unix / 1000, 'unixepoch', 'localtime') <= DATE(?)
            AND referral_code IS NOT NULL
            AND referral_code != ''
            GROUP BY referral_code
        `).bind(startDate, endDateStr).all();

        // Insert or update commission_payments
        let insertedCount = 0;
        let updatedCount = 0;

        for (const order of orders) {
            // Check if record exists
            const existing = await env.DB.prepare(`
                SELECT id FROM commission_payments
                WHERE referral_code = ? AND month = ?
            `).bind(order.referral_code, month).first();

            if (existing) {
                // Update existing record
                await env.DB.prepare(`
                    UPDATE commission_payments
                    SET commission_amount = ?,
                        order_count = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).bind(
                    order.total_commission,
                    order.order_count,
                    existing.id
                ).run();
                updatedCount++;
            } else {
                // Insert new record
                const now = Date.now();
                await env.DB.prepare(`
                    INSERT INTO commission_payments (
                        referral_code, month, commission_amount, order_count, status,
                        created_at_unix, updated_at_unix
                    ) VALUES (?, ?, ?, ?, 'pending', ?, ?)
                `).bind(
                    order.referral_code,
                    month,
                    order.total_commission,
                    order.order_count,
                    now,
                    now
                ).run();
                insertedCount++;
            }
        }

        return jsonResponse({
            success: true,
            message: `Calculated commissions for ${month}`,
            inserted: insertedCount,
            updated: updatedCount,
            total: orders.length
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error calculating commissions:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Mark commission as paid
 * POST ?action=markAsPaid
 * Body: { referralCode, month, paymentDate, paymentMethod, note }
 */
export async function markCommissionAsPaid(data, env, corsHeaders) {
    try {
        const { referralCode, month, paymentDate, paymentMethod, note } = data;

        if (!referralCode || !month) {
            return jsonResponse({
                success: false,
                error: 'referralCode and month are required'
            }, 400, corsHeaders);
        }

        // Check if record exists
        const existing = await env.DB.prepare(`
            SELECT id FROM commission_payments
            WHERE referral_code = ? AND month = ?
        `).bind(referralCode, month).first();

        if (!existing) {
            return jsonResponse({
                success: false,
                error: 'Commission record not found. Please calculate commissions first.'
            }, 404, corsHeaders);
        }

        // Update payment status
        const now = Date.now();
        const paymentDateStr = paymentDate || new Date().toISOString().split('T')[0];
        const paymentDateUnix = new Date(paymentDateStr + 'T00:00:00Z').getTime();
        
        await env.DB.prepare(`
            UPDATE commission_payments
            SET status = 'paid',
                payment_date = ?,
                payment_date_unix = ?,
                payment_method = ?,
                note = ?,
                updated_at = CURRENT_TIMESTAMP,
                updated_at_unix = ?
            WHERE id = ?
        `).bind(
            paymentDateStr,
            paymentDateUnix,
            paymentMethod || 'bank_transfer',
            note || '',
            now,
            existing.id
        ).run();

        return jsonResponse({
            success: true,
            message: 'Commission marked as paid'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error marking commission as paid:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Get payment history for a CTV
 * GET ?action=getPaymentHistory&referralCode=ABC123
 */
export async function getPaymentHistory(referralCode, env, corsHeaders) {
    try {
        if (!referralCode) {
            return jsonResponse({
                success: false,
                error: 'referralCode is required'
            }, 400, corsHeaders);
        }

        const { results: history } = await env.DB.prepare(`
            SELECT *
            FROM commission_payments
            WHERE referral_code = ?
            ORDER BY month DESC
        `).bind(referralCode).all();

        return jsonResponse({
            success: true,
            referralCode: referralCode,
            history: history
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting payment history:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// ============================================
// NEW PAYMENT SYSTEM - Pay by Individual Orders
// ============================================

/**
 * Get unpaid orders for a specific CTV
 * GET ?action=getUnpaidOrders&referralCode=CTV100001
 */
export async function getUnpaidOrders(referralCode, env, corsHeaders) {
    try {
        if (!referralCode) {
            return jsonResponse({
                success: false,
                error: 'referralCode is required'
            }, 400, corsHeaders);
        }

        // Chưa thanh toán: chưa có cpd, hoặc có cpd nhưng chưa nằm trong đợt commission_payments.status = 'paid'
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                o.id,
                o.order_id,
                o.created_at_unix,
                o.customer_name,
                o.customer_phone,
                o.address,
                o.products,
                o.payment_method,
                o.status,
                o.commission,
                o.created_at_unix,
                o.shipping_fee,
                cpd.is_excluded,
                cpd.excluded_at_unix,
                cpd.excluded_by,
                cpd.exclude_reason
            FROM orders o
            LEFT JOIN commission_payment_details cpd ON o.id = cpd.order_id
            LEFT JOIN commission_payments cp ON cpd.payment_id = cp.id
            WHERE o.referral_code = ?
            AND o.status NOT IN ('Đã hủy', 'Hủy')
            AND (
                cpd.id IS NULL
                OR (
                    cpd.is_excluded = 0
                    AND (cp.id IS NULL OR cp.status IS NULL OR cp.status != 'paid')
                )
            )
            ORDER BY o.created_at_unix DESC
        `).bind(referralCode).all();

        // Calculate summary
        const totalOrders = orders.length;
        const totalCommission = orders.reduce((sum, order) => sum + (order.commission || 0), 0);

        return jsonResponse({
            success: true,
            referralCode: referralCode,
            orders: orders,
            summary: {
                total_orders: totalOrders,
                total_commission: totalCommission
            }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting unpaid orders:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Get unpaid orders grouped by CTV for a specific month
 * GET ?action=getUnpaidOrdersByMonth&month=2025-11
 */
export async function getUnpaidOrdersByMonth(month, env, corsHeaders) {
    try {
        if (!month) {
            return jsonResponse({
                success: false,
                error: 'Month parameter is required (format: YYYY-MM)'
            }, 400, corsHeaders);
        }

        // Parse month to get start and end dates
        const [year, monthNum] = month.split('-');
        const startDate = `${year}-${monthNum}-01`;
        const endDate = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
        const endDateStr = `${year}-${monthNum}-${endDate}`;

        // Get all CTVs
        const { results: ctvList } = await env.DB.prepare(`
            SELECT referral_code, full_name, phone, commission_rate, bank_account_number, bank_name
            FROM ctv
            WHERE status != 'Tạm ngưng'
            ORDER BY full_name ASC
        `).all();

        // Chưa thanh toán: chưa có cpd, hoặc cpd chưa gắn đợt thanh toán paid; đơn đã loại (is_excluded=1) không hiện đây
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                o.referral_code,
                o.id as order_id,
                o.order_id as order_code,
                o.created_at_unix,
                o.customer_name,
                o.commission,
                o.status,
                o.created_at_unix,
                cpd.is_excluded,
                cpd.excluded_at_unix,
                cpd.excluded_by,
                cpd.exclude_reason
            FROM orders o
            LEFT JOIN commission_payment_details cpd ON o.id = cpd.order_id
            LEFT JOIN commission_payments cp ON cpd.payment_id = cp.id
            WHERE o.status NOT IN ('Đã hủy', 'Hủy')
            AND DATE(o.created_at_unix / 1000, 'unixepoch', 'localtime') >= DATE(?)
            AND DATE(o.created_at_unix / 1000, 'unixepoch', 'localtime') <= DATE(?)
            AND o.referral_code IS NOT NULL
            AND o.referral_code != ''
            AND (
                cpd.id IS NULL
                OR (
                    cpd.is_excluded = 0
                    AND (cp.id IS NULL OR cp.status IS NULL OR cp.status != 'paid')
                )
            )
            ORDER BY o.created_at_unix DESC
        `).bind(startDate, endDateStr).all();

        // Group orders by CTV
        const ctvMap = {};
        orders.forEach(order => {
            if (!ctvMap[order.referral_code]) {
                ctvMap[order.referral_code] = {
                    orders: [],
                    total_commission: 0,
                    order_count: 0
                };
            }
            ctvMap[order.referral_code].orders.push(order);
            ctvMap[order.referral_code].total_commission += order.commission || 0;
            ctvMap[order.referral_code].order_count += 1;
        });

        // Combine with CTV info
        const commissionList = ctvList.map(ctv => {
            const ctvData = ctvMap[ctv.referral_code];
            if (!ctvData) return null;

            return {
                referral_code: ctv.referral_code,
                ctv_name: ctv.full_name,
                phone: ctv.phone,
                commission_rate: ctv.commission_rate,
                bank_account_number: ctv.bank_account_number,
                bank_name: ctv.bank_name,
                order_count: ctvData.order_count,
                commission_amount: ctvData.total_commission,
                orders: ctvData.orders
            };
        }).filter(item => item !== null);

        // Calculate summary
        const summary = {
            total_ctv: commissionList.length,
            total_orders: orders.length,
            total_commission: commissionList.reduce((sum, c) => sum + c.commission_amount, 0)
        };

        return jsonResponse({
            success: true,
            month: month,
            commissions: commissionList,
            summary: summary
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting unpaid orders by month:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Pay selected orders
 * POST ?action=paySelectedOrders
 * Body: {
 *   referralCode: "CTV100001",
 *   orderIds: [1, 2, 3],
 *   paymentDate: "2025-11-16",
 *   paymentMethod: "bank_transfer",
 *   note: "Chuyển khoản MB Bank"
 * }
 */
export async function paySelectedOrders(data, env, corsHeaders) {
    try {
        const { referralCode, orderIds, paymentDate, paymentMethod, note } = data;

        // Validate input
        if (!referralCode || !orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return jsonResponse({
                success: false,
                error: 'referralCode and orderIds are required'
            }, 400, corsHeaders);
        }

        // Get CTV info
        const ctv = await env.DB.prepare(`
            SELECT full_name, phone FROM ctv WHERE referral_code = ?
        `).bind(referralCode).first();

        if (!ctv) {
            return jsonResponse({
                success: false,
                error: 'CTV not found'
            }, 404, corsHeaders);
        }

        // Get orders to verify they exist and calculate total
        const placeholders = orderIds.map(() => '?').join(',');
        const { results: orders } = await env.DB.prepare(`
            SELECT id, order_id, commission, referral_code
            FROM orders
            WHERE id IN (${placeholders})
            AND referral_code = ?
        `).bind(...orderIds, referralCode).all();

        if (orders.length !== orderIds.length) {
            return jsonResponse({
                success: false,
                error: 'Some orders not found or do not belong to this CTV'
            }, 400, corsHeaders);
        }

        // Check if any order is already paid
        const { results: alreadyPaid } = await env.DB.prepare(`
            SELECT order_id FROM commission_payment_details
            WHERE order_id IN (${placeholders})
        `).bind(...orderIds).all();

        if (alreadyPaid.length > 0) {
            return jsonResponse({
                success: false,
                error: 'Some orders have already been paid'
            }, 400, corsHeaders);
        }

        // Calculate total commission
        const totalCommission = orders.reduce((sum, order) => sum + (order.commission || 0), 0);

        // Create payment record
        const now = Date.now();
        const paymentDateStr = paymentDate || new Date().toISOString().split('T')[0];
        const paymentDateUnix = new Date(paymentDateStr + 'T00:00:00Z').getTime();
        
        const paymentResult = await env.DB.prepare(`
            INSERT INTO commission_payments (
                referral_code,
                month,
                order_count,
                commission_amount,
                status,
                payment_date_unix,
                payment_method,
                note,
                created_at_unix,
                updated_at_unix
            ) VALUES (?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?)
        `).bind(
            referralCode,
            new Date().toISOString().slice(0, 7), // YYYY-MM
            orders.length,
            totalCommission,
            paymentDateUnix,
            paymentMethod || 'bank_transfer',
            note || '',
            now,
            now
        ).run();

        const paymentId = paymentResult.meta.last_row_id;

        // Create payment details for each order
        const detailsTimestamp = Date.now();
        for (const order of orders) {
            await env.DB.prepare(`
                INSERT INTO commission_payment_details (
                    payment_id,
                    order_id,
                    commission_amount,
                    created_at_unix
                ) VALUES (?, ?, ?, ?)
            `).bind(paymentId, order.id, order.commission, detailsTimestamp).run();
        }

        return jsonResponse({
            success: true,
            message: `Đã thanh toán ${orders.length} đơn hàng cho ${ctv.full_name}`,
            payment: {
                payment_id: paymentId,
                referral_code: referralCode,
                ctv_name: ctv.full_name,
                order_count: orders.length,
                total_commission: totalCommission,
                payment_date: paymentDate || new Date().toISOString().split('T')[0],
                payment_method: paymentMethod || 'bank_transfer'
            }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error paying selected orders:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// ============================================
// EXCLUDE / RESTORE COMMISSION
// ============================================

/**
 * Exclude an order's commission from payment (e.g. delivery failed)
 * POST ?action=excludeOrderCommission
 * Body: { orderId: number, reason?: string, adminUsername: string }
 */
export async function excludeOrderCommission(data, env, corsHeaders) {
    try {
        const { orderId, reason, adminUsername } = data;

        if (!orderId) {
            return jsonResponse({
                success: false,
                error: 'orderId là bắt buộc'
            }, 400, corsHeaders);
        }

        // Lấy thông tin đơn hàng từ bảng orders
        const orderInfo = await env.DB.prepare(`
            SELECT id, referral_code, commission FROM orders WHERE id = ?
        `).bind(orderId).first();

        if (!orderInfo) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy đơn hàng'
            }, 404, corsHeaders);
        }

        // Check if commission_payment_details record exists
        const existing = await env.DB.prepare(`
            SELECT id, is_excluded FROM commission_payment_details WHERE order_id = ?
        `).bind(orderId).first();

        const now = Date.now();

        if (!existing) {
            // Tạo dummy payment record (id=0) nếu chưa tồn tại — dùng làm sentinel cho đơn chưa thanh toán
            await env.DB.prepare(`
                INSERT OR IGNORE INTO commission_payments (id, referral_code, month, commission_amount, order_count, status, created_at_unix, updated_at_unix)
                VALUES (0, '', 'pending', 0, 0, 'pending', 0, 0)
            `).run();

            const insertResult = await env.DB.prepare(`
                INSERT INTO commission_payment_details (
                    payment_id, order_id, commission_amount,
                    is_excluded, excluded_at_unix, excluded_by, exclude_reason
                ) VALUES (0, ?, ?, 1, ?, ?, ?)
            `).bind(
                orderId,
                orderInfo.commission || 0,
                now,
                adminUsername || 'admin',
                reason || ''
            ).run();

            if (!insertResult.success) {
                console.error('❌ INSERT failed:', insertResult.error);
                return jsonResponse({
                    success: false,
                    error: 'Không thể tạo bản ghi loại hoa hồng: ' + (insertResult.error || 'Unknown error')
                }, 500, corsHeaders);
            }
        } else if (existing.is_excluded === 1) {
            return jsonResponse({
                success: false,
                error: 'Hoa hồng này đã được loại khỏi thanh toán trước đó'
            }, 400, corsHeaders);
        } else {
            // Đã có bản ghi (đã thanh toán) nhưng chưa bị loại → UPDATE
            const updateResult = await env.DB.prepare(`
                UPDATE commission_payment_details
                SET is_excluded = 1,
                    excluded_at_unix = ?,
                    excluded_by = ?,
                    exclude_reason = ?
                WHERE order_id = ?
            `).bind(now, adminUsername || 'admin', reason || '', orderId).run();

            if (!updateResult.success) {
                console.error('❌ UPDATE failed:', updateResult.error);
                return jsonResponse({
                    success: false,
                    error: 'Không thể cập nhật hoa hồng: ' + (updateResult.error || 'Unknown error')
                }, 500, corsHeaders);
            }
        }

        console.log(`✅ Đã loại hoa hồng đơn ${orderId} khỏi thanh toán`);

        return jsonResponse({
            success: true,
            message: `Đã loại đơn hàng khỏi danh sách thanh toán`,
            orderId,
            excludedAt: now,
            excludedBy: adminUsername || 'admin'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error excluding commission:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Restore an excluded commission back to payment list
 * POST ?action=restoreOrderCommission
 * Body: { orderId: number, adminUsername: string }
 */
export async function restoreOrderCommission(data, env, corsHeaders) {
    try {
        const { orderId, adminUsername } = data;

        if (!orderId) {
            return jsonResponse({
                success: false,
                error: 'orderId là bắt buộc'
            }, 400, corsHeaders);
        }

        const existing = await env.DB.prepare(`
            SELECT id, is_excluded FROM commission_payment_details WHERE order_id = ?
        `).bind(orderId).first();

        if (!existing) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy bản ghi hoa hồng cho đơn hàng này'
            }, 404, corsHeaders);
        }

        if (existing.is_excluded === 0) {
            return jsonResponse({
                success: false,
                error: 'Hoa hồng này không bị loại, không cần khôi phục'
            }, 400, corsHeaders);
        }

        const now = Date.now();

        const deleteResult = await env.DB.prepare(`
            DELETE FROM commission_payment_details WHERE order_id = ?
        `).bind(orderId).run();

        if (!deleteResult.success) {
            console.error('❌ DELETE failed:', deleteResult.error);
            return jsonResponse({
                success: false,
                error: 'Không thể khôi phục hoa hồng: ' + (deleteResult.error || 'Unknown error')
            }, 500, corsHeaders);
        }

        console.log(`✅ Đã khôi phục hoa hồng đơn ${orderId} vào danh sách thanh toán`);

        return jsonResponse({
            success: true,
            message: `Đã khôi phục hoa hồng vào danh sách thanh toán`,
            orderId
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error restoring commission:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Get all excluded commissions (for audit/admin view)
 * GET ?action=getExcludedCommissions&month=2026-03
 * GET ?action=getExcludedCommissions&month=2026-03&referralCode=CTV100001&status=all
 * status: all | excluded | restored
 */
export async function getExcludedCommissions(month, referralCode, status, env, corsHeaders, rangeDates = null) {
    try {
        let startDate;
        let endDateStr;

        if (rangeDates && rangeDates.startDate && rangeDates.endDate) {
            startDate = rangeDates.startDate;
            endDateStr = rangeDates.endDate;
        } else {
            if (!month) {
                return jsonResponse({
                    success: false,
                    error: 'Month parameter is required (format: YYYY-MM), or pass startDate and endDate (YYYY-MM-DD)'
                }, 400, corsHeaders);
            }

            const [year, monthNum] = month.split('-');
            startDate = `${year}-${monthNum}-01`;
            const endDate = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
            endDateStr = `${year}-${monthNum}-${endDate}`;
        }

        // Get list of CTVs for filter dropdown
        const { results: ctvList } = await env.DB.prepare(`
            SELECT referral_code, full_name
            FROM ctv
            WHERE status != 'Tạm ngưng'
            ORDER BY full_name ASC
        `).all();

        // Mặc định: chỉ đơn đang bị loại (is_excluded = 1). Đã khôi phục không hiện trừ khi chọn filter lịch sử.
        const statusNorm = (status && String(status).trim().toLowerCase()) || 'excluded';
        let isExcludedFilter = '';
        if (statusNorm === 'restored') {
            isExcludedFilter = 'AND cpd.is_excluded = 0 AND cpd.restored_at_unix IS NOT NULL';
        } else if (statusNorm === 'all') {
            // audit: cả đang loại + đã khôi phục (bản ghi còn trong cpd)
        } else {
            isExcludedFilter = 'AND cpd.is_excluded = 1';
        }

        const referralFilter = referralCode ? 'AND o.referral_code = ?' : '';

        const params = [startDate, endDateStr];
        if (referralCode) params.push(referralCode);

        const { results } = await env.DB.prepare(`
            SELECT
                cpd.*,
                o.order_id as order_code,
                o.customer_name,
                o.created_at_unix as order_created_at,
                o.referral_code,
                c.full_name as ctv_name,
                c.phone as ctv_phone
            FROM commission_payment_details cpd
            LEFT JOIN orders o ON cpd.order_id = o.id
            LEFT JOIN ctv c ON o.referral_code = c.referral_code
            WHERE DATE(o.created_at_unix / 1000, 'unixepoch', 'localtime') >= DATE(?)
            AND DATE(o.created_at_unix / 1000, 'unixepoch', 'localtime') <= DATE(?)
            ${isExcludedFilter}
            ${referralFilter}
            ORDER BY COALESCE(cpd.excluded_at_unix, cpd.restored_at_unix) DESC
        `).bind(...params).all();

        return jsonResponse({
            success: true,
            month,
            referralCode: referralCode || null,
            status: statusNorm,
            excludedCommissions: results,
            ctvList,
            summary: {
                total: results.length,
                totalExcluded: results.filter(r => r.is_excluded === 1).length,
                totalRestored: results.filter(r => r.is_excluded === 0 && r.restored_at_unix).length,
                totalAmount: results.reduce((sum, r) => sum + (r.commission_amount || 0), 0)
            }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting excluded commissions:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
