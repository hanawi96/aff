-- Bảng Cộng Tác Viên
CREATE TABLE IF NOT EXISTS ctv (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  city TEXT,
  age TEXT,
  bank_account_number TEXT,
  bank_name TEXT,
  experience TEXT,
  motivation TEXT,
  referral_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'Mới',
  commission_rate REAL DEFAULT 0.1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Đơn Hàng
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT UNIQUE NOT NULL,
  order_date TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  address TEXT,
  products TEXT,
  total_amount REAL DEFAULT 0,
  payment_method TEXT,
  status TEXT,
  referral_code TEXT,
  commission REAL DEFAULT 0,
  ctv_phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referral_code) REFERENCES ctv(referral_code)
);

-- Index để tăng tốc query
CREATE INDEX IF NOT EXISTS idx_ctv_referral_code ON ctv(referral_code);
CREATE INDEX IF NOT EXISTS idx_ctv_phone ON ctv(phone);
CREATE INDEX IF NOT EXISTS idx_orders_referral_code ON orders(referral_code);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_ctv_phone ON orders(ctv_phone);

-- Trigger tự động update updated_at
CREATE TRIGGER IF NOT EXISTS update_ctv_timestamp 
AFTER UPDATE ON ctv
BEGIN
  UPDATE ctv SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
