-- Migration: Import discounts from JSON to D1
-- Generated: 2025-11-20T11:45:42.969Z

INSERT INTO discounts (
      code, title, description, type, 
      discount_value, gift_product_id, gift_product_name, gift_quantity,
      min_order_amount, min_items, 
      max_uses_per_customer, customer_type,
      combinable_with_other_discounts,
      active, visible, expiry_date
    ) VALUES (
      'GIAM2K',
      'Giảm 2.000đ',
      'Giảm ngay 2.000đ cho mọi đơn hàng.',
      'fixed',
      2000,
      NULL,
      NULL,
      1,
      20000,
      0,
      1,
      'all',
      0,
      1,
      1,
      '2025-12-31'
    );

INSERT INTO discounts (
      code, title, description, type, 
      discount_value, gift_product_id, gift_product_name, gift_quantity,
      min_order_amount, min_items, 
      max_uses_per_customer, customer_type,
      combinable_with_other_discounts,
      active, visible, expiry_date
    ) VALUES (
      'QUATANGBDT7',
      'Tặng Bó dâu 7 cành (bé trai)',
      'Nhận ngay 1 Bó dâu 7 cành (bé trai) trị giá 109.000đ khi mua từ 2 sản phẩm',
      'gift',
      0,
      'addon_bo_dau_tam_7_canh',
      'Bó dâu 7 cành (bé trai)',
      1,
      300000,
      2,
      1,
      'all',
      0,
      1,
      1,
      '2025-12-31'
    );

INSERT INTO discounts (
      code, title, description, type, 
      discount_value, gift_product_id, gift_product_name, gift_quantity,
      min_order_amount, min_items, 
      max_uses_per_customer, customer_type,
      combinable_with_other_discounts,
      active, visible, expiry_date
    ) VALUES (
      'QUATANGBDT9',
      'Tặng Bó dâu 9 cành (bé gái)',
      'Nhận ngay 1 Bó dâu 9 cành (bé gái) trị giá 119.000đ khi mua từ 2 sản phẩm',
      'gift',
      0,
      'addon_bo_dau_tam_9_canh',
      'Bó dâu 9 cành (bé gái)',
      1,
      300000,
      2,
      1,
      'all',
      0,
      1,
      1,
      '2025-12-31'
    );

INSERT INTO discounts (
      code, title, description, type, 
      discount_value, gift_product_id, gift_product_name, gift_quantity,
      min_order_amount, min_items, 
      max_uses_per_customer, customer_type,
      combinable_with_other_discounts,
      active, visible, expiry_date
    ) VALUES (
      'QUATANGTDT',
      'Tặng 1 Túi Dâu Tằm Để Giường',
      'Nhận ngay 1 Túi Dâu Tằm Để Giường trị giá 45.000đ khi mua từ 2 sản phẩm',
      'gift',
      0,
      'addon_tui_dau_tam',
      'Túi Dâu Tằm Để Giường',
      1,
      300000,
      2,
      1,
      'all',
      0,
      1,
      1,
      '2025-12-31'
    );

INSERT INTO discounts (
      code, title, description, type, 
      discount_value, gift_product_id, gift_product_name, gift_quantity,
      min_order_amount, min_items, 
      max_uses_per_customer, customer_type,
      combinable_with_other_discounts,
      active, visible, expiry_date
    ) VALUES (
      'QUATANGMCK',
      'Tặng 1 Móc chìa khóa dâu tằm',
      'Nhận ngay 1 Móc chìa khóa dâu tằm trị giá 49.000đ khi mua từ 2 sản phẩm',
      'gift',
      0,
      'addon_moc_chia_khoa',
      'Móc chìa khóa dâu tằm',
      1,
      300000,
      2,
      1,
      'all',
      0,
      1,
      1,
      '2025-12-31'
    );

INSERT INTO discounts (
      code, title, description, type, 
      discount_value, gift_product_id, gift_product_name, gift_quantity,
      min_order_amount, min_items, 
      max_uses_per_customer, customer_type,
      combinable_with_other_discounts,
      active, visible, expiry_date
    ) VALUES (
      'GG5K',
      'Giảm 5.000đ',
      'Giảm trực tiếp 5.000đ vào tổng giá trị đơn hàng.',
      'fixed',
      5000,
      NULL,
      NULL,
      1,
      0,
      1,
      1,
      'all',
      0,
      1,
      0,
      '2025-12-31'
    );

INSERT INTO discounts (
      code, title, description, type, 
      discount_value, gift_product_id, gift_product_name, gift_quantity,
      min_order_amount, min_items, 
      max_uses_per_customer, customer_type,
      combinable_with_other_discounts,
      active, visible, expiry_date
    ) VALUES (
      'GG10K',
      'Giảm 10.000đ',
      'Giảm trực tiếp 10.000đ vào tổng giá trị đơn hàng.',
      'fixed',
      10000,
      NULL,
      NULL,
      1,
      0,
      1,
      1,
      'all',
      0,
      1,
      0,
      '2025-12-31'
    );

INSERT INTO discounts (
      code, title, description, type, 
      discount_value, gift_product_id, gift_product_name, gift_quantity,
      min_order_amount, min_items, 
      max_uses_per_customer, customer_type,
      combinable_with_other_discounts,
      active, visible, expiry_date
    ) VALUES (
      'GG15K',
      'Giảm 15.000đ',
      'Giảm trực tiếp 15.000đ vào tổng giá trị đơn hàng.',
      'fixed',
      15000,
      NULL,
      NULL,
      1,
      0,
      1,
      1,
      'all',
      0,
      1,
      0,
      '2025-12-31'
    );

INSERT INTO discounts (
      code, title, description, type, 
      discount_value, gift_product_id, gift_product_name, gift_quantity,
      min_order_amount, min_items, 
      max_uses_per_customer, customer_type,
      combinable_with_other_discounts,
      active, visible, expiry_date
    ) VALUES (
      'GG20K',
      'Giảm 20.000đ',
      'Giảm trực tiếp 20.000đ vào tổng giá trị đơn hàng.',
      'fixed',
      20000,
      NULL,
      NULL,
      1,
      0,
      1,
      1,
      'all',
      0,
      1,
      0,
      '2025-12-31'
    );

INSERT INTO discounts (
      code, title, description, type, 
      discount_value, gift_product_id, gift_product_name, gift_quantity,
      min_order_amount, min_items, 
      max_uses_per_customer, customer_type,
      combinable_with_other_discounts,
      active, visible, expiry_date
    ) VALUES (
      'GG25K',
      'Giảm 25.000đ',
      'Giảm trực tiếp 25.000đ vào tổng giá trị đơn hàng.',
      'fixed',
      25000,
      NULL,
      NULL,
      1,
      0,
      1,
      1,
      'all',
      0,
      1,
      0,
      '2025-12-31'
    );

INSERT INTO discounts (
      code, title, description, type, 
      discount_value, gift_product_id, gift_product_name, gift_quantity,
      min_order_amount, min_items, 
      max_uses_per_customer, customer_type,
      combinable_with_other_discounts,
      active, visible, expiry_date
    ) VALUES (
      'GG30K',
      'Giảm 30.000đ',
      'Giảm trực tiếp 30.000đ vào tổng giá trị đơn hàng.',
      'fixed',
      30000,
      NULL,
      NULL,
      1,
      0,
      1,
      1,
      'all',
      0,
      1,
      0,
      '2025-12-31'
    );

INSERT INTO discounts (
      code, title, description, type, 
      discount_value, gift_product_id, gift_product_name, gift_quantity,
      min_order_amount, min_items, 
      max_uses_per_customer, customer_type,
      combinable_with_other_discounts,
      active, visible, expiry_date
    ) VALUES (
      'VDT4K',
      'Giảm 4.000đ',
      'Giảm 4.000đ cho đơn hàng từ 120.000đ.',
      'fixed',
      4000,
      NULL,
      NULL,
      1,
      120000,
      1,
      1,
      'all',
      0,
      1,
      1,
      '2025-12-31'
    );

INSERT INTO discounts (
      code, title, description, type, 
      discount_value, gift_product_id, gift_product_name, gift_quantity,
      min_order_amount, min_items, 
      max_uses_per_customer, customer_type,
      combinable_with_other_discounts,
      active, visible, expiry_date
    ) VALUES (
      'VDT6K',
      'Giảm 6.000đ',
      'Giảm 6.000đ cho đơn hàng từ 150.000đ.',
      'fixed',
      6000,
      NULL,
      NULL,
      1,
      150000,
      1,
      1,
      'all',
      0,
      1,
      1,
      '2025-12-31'
    );

INSERT INTO discounts (
      code, title, description, type, 
      discount_value, gift_product_id, gift_product_name, gift_quantity,
      min_order_amount, min_items, 
      max_uses_per_customer, customer_type,
      combinable_with_other_discounts,
      active, visible, expiry_date
    ) VALUES (
      'VDT8K',
      'Giảm 8.000đ',
      'Giảm 6.000đ cho đơn hàng từ 180.000đ.',
      'fixed',
      8000,
      NULL,
      NULL,
      1,
      180000,
      1,
      1,
      'all',
      0,
      1,
      1,
      '2025-12-31'
    );

INSERT INTO discounts (
      code, title, description, type, 
      discount_value, gift_product_id, gift_product_name, gift_quantity,
      min_order_amount, min_items, 
      max_uses_per_customer, customer_type,
      combinable_with_other_discounts,
      active, visible, expiry_date
    ) VALUES (
      'VDT10K',
      'Giảm 10.000đ',
      'Giảm 8.000đ cho đơn hàng từ 220.000đ.',
      'fixed',
      10000,
      NULL,
      NULL,
      1,
      220000,
      1,
      1,
      'all',
      0,
      1,
      1,
      '2025-12-31'
    );

INSERT INTO discounts (
      code, title, description, type, 
      discount_value, gift_product_id, gift_product_name, gift_quantity,
      min_order_amount, min_items, 
      max_uses_per_customer, customer_type,
      combinable_with_other_discounts,
      active, visible, expiry_date
    ) VALUES (
      'VDT12K',
      'Giảm 12.000đ',
      'Giảm 12.000đ cho đơn hàng từ 250.000đ.',
      'fixed',
      12000,
      NULL,
      NULL,
      1,
      250000,
      1,
      1,
      'all',
      0,
      1,
      1,
      '2025-12-31'
    );

INSERT INTO discounts (
      code, title, description, type, 
      discount_value, gift_product_id, gift_product_name, gift_quantity,
      min_order_amount, min_items, 
      max_uses_per_customer, customer_type,
      combinable_with_other_discounts,
      active, visible, expiry_date
    ) VALUES (
      'VDT15K',
      'Giảm 15.000đ',
      'Giảm 15.000đ cho đơn hàng từ 250.000đ.',
      'fixed',
      15000,
      NULL,
      NULL,
      1,
      300000,
      1,
      1,
      'all',
      0,
      1,
      1,
      '2025-12-31'
    );
