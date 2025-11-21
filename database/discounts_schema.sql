-- ============================================
-- BẢNG MÃ GIẢM GIÁ / KHUYẾN MÃI
-- ============================================

-- Bảng chính: Mã giảm giá
CREATE TABLE IF NOT EXISTS discounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  
  -- Loại khuyến mãi
  type TEXT NOT NULL CHECK(type IN ('fixed', 'percentage', 'gift', 'freeship')),
  
  -- Giá trị giảm (cho fixed/percentage)
  discount_value INTEGER DEFAULT 0,
  
  -- Giá trị tối đa được giảm (cho percentage)
  max_discount_amount INTEGER,
  
  -- Thông tin quà tặng (cho type = 'gift')
  gift_product_id TEXT,
  gift_product_name TEXT,
  gift_quantity INTEGER DEFAULT 1,
  
  -- Điều kiện áp dụng
  min_order_amount INTEGER DEFAULT 0,
  min_items INTEGER DEFAULT 0,
  
  -- Giới hạn sử dụng
  max_total_uses INTEGER,  -- Tổng số lần dùng tối đa (NULL = không giới hạn)
  max_uses_per_customer INTEGER DEFAULT 1,  -- Mỗi khách dùng tối đa bao nhiêu lần
  
  -- Áp dụng cho đối tượng cụ thể
  customer_type TEXT CHECK(customer_type IN ('all', 'new', 'existing', 'vip')),
  allowed_customer_phones TEXT,  -- JSON array: ["0901234567", "0912345678"]
  
  -- Áp dụng cho sản phẩm/danh mục cụ thể
  applicable_products TEXT,  -- JSON array: ["product_id_1", "product_id_2"]
  applicable_categories TEXT,  -- JSON array: ["category_id_1", "category_id_2"]
  excluded_products TEXT,  -- JSON array: sản phẩm loại trừ
  
  -- Kết hợp với mã khác
  combinable_with_other_discounts BOOLEAN DEFAULT 0,
  priority INTEGER DEFAULT 0,  -- Thứ tự ưu tiên khi áp dụng nhiều mã
  
  -- Trạng thái
  active BOOLEAN DEFAULT 1,
  visible BOOLEAN DEFAULT 1,  -- Hiển thị công khai hay không
  
  -- Thời gian
  start_date DATETIME,
  expiry_date DATETIME NOT NULL,
  
  -- Metadata
  created_by TEXT,  -- Admin tạo mã
  notes TEXT,  -- Ghi chú nội bộ
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Thống kê
  usage_count INTEGER DEFAULT 0,
  total_discount_amount INTEGER DEFAULT 0  -- Tổng số tiền đã giảm
);

-- Bảng lịch sử sử dụng mã giảm giá
CREATE TABLE IF NOT EXISTS discount_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discount_id INTEGER NOT NULL,
  discount_code TEXT NOT NULL,
  
  -- Thông tin đơn hàng
  order_id TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT NOT NULL,
  
  -- Giá trị giảm giá thực tế
  order_amount INTEGER,  -- Giá trị đơn hàng
  discount_amount INTEGER,  -- Số tiền được giảm
  gift_received TEXT,  -- Quà tặng nhận được (nếu có)
  
  -- Metadata
  used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,
  
  FOREIGN KEY (discount_id) REFERENCES discounts(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

-- Bảng quy tắc tự động áp dụng mã
CREATE TABLE IF NOT EXISTS discount_auto_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discount_id INTEGER NOT NULL,
  
  -- Điều kiện tự động áp dụng
  rule_type TEXT CHECK(rule_type IN ('cart_value', 'product_quantity', 'first_order', 'birthday', 'special_day')),
  rule_config TEXT,  -- JSON config cho rule
  
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (discount_id) REFERENCES discounts(id) ON DELETE CASCADE
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_discounts_code ON discounts(code);
CREATE INDEX IF NOT EXISTS idx_discounts_active ON discounts(active, visible);
CREATE INDEX IF NOT EXISTS idx_discounts_dates ON discounts(start_date, expiry_date);
CREATE INDEX IF NOT EXISTS idx_discounts_type ON discounts(type);

CREATE INDEX IF NOT EXISTS idx_discount_usage_discount ON discount_usage(discount_id);
CREATE INDEX IF NOT EXISTS idx_discount_usage_order ON discount_usage(order_id);
CREATE INDEX IF NOT EXISTS idx_discount_usage_customer ON discount_usage(customer_phone);
CREATE INDEX IF NOT EXISTS idx_discount_usage_date ON discount_usage(used_at);

CREATE INDEX IF NOT EXISTS idx_discount_auto_rules_discount ON discount_auto_rules(discount_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Tự động cập nhật updated_at
CREATE TRIGGER IF NOT EXISTS update_discounts_timestamp 
AFTER UPDATE ON discounts
BEGIN
  UPDATE discounts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Tự động tăng usage_count và total_discount_amount
CREATE TRIGGER IF NOT EXISTS increment_discount_usage
AFTER INSERT ON discount_usage
BEGIN
  UPDATE discounts 
  SET 
    usage_count = usage_count + 1,
    total_discount_amount = total_discount_amount + NEW.discount_amount
  WHERE id = NEW.discount_id;
END;

-- Tự động giảm usage_count khi xóa usage (VD: hủy đơn)
CREATE TRIGGER IF NOT EXISTS decrement_discount_usage
AFTER DELETE ON discount_usage
BEGIN
  UPDATE discounts 
  SET 
    usage_count = usage_count - 1,
    total_discount_amount = total_discount_amount - OLD.discount_amount
  WHERE id = OLD.discount_id;
END;
