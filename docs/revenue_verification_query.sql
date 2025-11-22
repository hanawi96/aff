-- ============================================
-- REVENUE VERIFICATION QUERY
-- Kiểm tra xem revenue tính theo 2 cách có khớp nhau không
-- ============================================

-- Query 1: So sánh revenue tính bằng 2 cách
SELECT 
    order_id,
    total_amount as actual_revenue,
    (
        COALESCE((SELECT SUM(product_price * quantity) FROM order_items WHERE order_items.order_id = orders.id), 0)
        + COALESCE(shipping_fee, 0)
        - COALESCE(discount_amount, 0)
    ) as calculated_revenue,
    ABS(
        total_amount - (
            COALESCE((SELECT SUM(product_price * quantity) FROM order_items WHERE order_items.order_id = orders.id), 0)
            + COALESCE(shipping_fee, 0)
            - COALESCE(discount_amount, 0)
        )
    ) as difference
FROM orders
WHERE ABS(
    total_amount - (
        COALESCE((SELECT SUM(product_price * quantity) FROM order_items WHERE order_items.order_id = orders.id), 0)
        + COALESCE(shipping_fee, 0)
        - COALESCE(discount_amount, 0)
    )
) > 1  -- Chênh lệch > 1đ
ORDER BY difference DESC
LIMIT 20;

-- Query 2: Thống kê tổng quan
SELECT 
    COUNT(*) as total_orders,
    SUM(total_amount) as total_revenue_from_db,
    SUM(
        COALESCE((SELECT SUM(product_price * quantity) FROM order_items WHERE order_items.order_id = orders.id), 0)
        + COALESCE(shipping_fee, 0)
        - COALESCE(discount_amount, 0)
    ) as total_revenue_calculated,
    SUM(total_amount) - SUM(
        COALESCE((SELECT SUM(product_price * quantity) FROM order_items WHERE order_items.order_id = orders.id), 0)
        + COALESCE(shipping_fee, 0)
        - COALESCE(discount_amount, 0)
    ) as total_difference
FROM orders;

-- Query 3: Kiểm tra các đơn hàng có discount
SELECT 
    order_id,
    total_amount,
    discount_code,
    discount_amount,
    shipping_fee,
    (SELECT SUM(product_price * quantity) FROM order_items WHERE order_items.order_id = orders.id) as product_total,
    (
        (SELECT SUM(product_price * quantity) FROM order_items WHERE order_items.order_id = orders.id)
        + shipping_fee
        - discount_amount
    ) as calculated_total,
    (total_amount - (
        (SELECT SUM(product_price * quantity) FROM order_items WHERE order_items.order_id = orders.id)
        + shipping_fee
        - discount_amount
    )) as difference
FROM orders
WHERE discount_amount > 0
ORDER BY created_at DESC
LIMIT 10;

-- Query 4: Kiểm tra profit calculation
SELECT 
    order_id,
    total_amount as revenue,
    (SELECT SUM(product_cost * quantity) FROM order_items WHERE order_items.order_id = orders.id) as product_cost,
    shipping_cost,
    packaging_cost,
    commission,
    tax_amount,
    (
        total_amount 
        - COALESCE((SELECT SUM(product_cost * quantity) FROM order_items WHERE order_items.order_id = orders.id), 0)
        - COALESCE(shipping_cost, 0)
        - COALESCE(packaging_cost, 0)
        - COALESCE(commission, 0)
        - COALESCE(tax_amount, 0)
    ) as profit
FROM orders
ORDER BY created_at DESC
LIMIT 10;

-- Query 5: Test với period cụ thể (tuần này)
-- Thay đổi timestamp theo tuần bạn muốn test
WITH week_data AS (
    SELECT 
        DATE(created_at_unix/1000, 'unixepoch') as order_date,
        total_amount as revenue,
        (SELECT SUM(product_cost * quantity) FROM order_items WHERE order_items.order_id = orders.id) as product_cost,
        shipping_cost,
        packaging_cost,
        commission,
        tax_amount
    FROM orders
    WHERE created_at_unix >= 1700438400000  -- Thay đổi timestamp này
    AND created_at_unix <= 1701043199999    -- Thay đổi timestamp này
)
SELECT 
    order_date,
    COUNT(*) as orders_count,
    SUM(revenue) as total_revenue,
    SUM(product_cost + COALESCE(shipping_cost, 0) + COALESCE(packaging_cost, 0) + COALESCE(commission, 0) + COALESCE(tax_amount, 0)) as total_cost,
    SUM(revenue) - SUM(product_cost + COALESCE(shipping_cost, 0) + COALESCE(packaging_cost, 0) + COALESCE(commission, 0) + COALESCE(tax_amount, 0)) as total_profit
FROM week_data
GROUP BY order_date
ORDER BY order_date;

-- ============================================
-- KẾT QUẢ MONG ĐỢI
-- ============================================

-- Query 1: Không có kết quả (hoặc difference rất nhỏ < 1đ)
-- Query 2: total_difference = 0 (hoặc rất nhỏ)
-- Query 3: calculated_total = total_amount
-- Query 4: Profit hợp lý (không âm quá nhiều)
-- Query 5: Số liệu khớp với biểu đồ trên UI
