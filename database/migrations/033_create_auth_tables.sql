-- Migration: Create authentication tables
-- Date: 2024-11-24
-- Description: Tạo bảng users và sessions cho authentication

-- ============================================
-- 1. Tạo bảng users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'admin',
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ============================================
-- 2. Tạo bảng sessions
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 3. Tạo indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================
-- 4. Tạo user admin mặc định
-- ============================================
-- Password: admin123 (PHẢI ĐỔI SAU KHI ĐĂNG NHẬP LẦN ĐẦU)
-- Hash được tạo bằng bcryptjs với cost 10
INSERT OR IGNORE INTO users (username, password_hash, full_name, role, is_active, created_at, updated_at)
VALUES (
  'admin',
  '$2b$10$fmO1TlLdVYiHX0WsrgvosOd09T6vzKdgbthZ4r2.zkOef4NiGCl6S',
  'Administrator',
  'admin',
  1,
  unixepoch(),
  unixepoch()
);

-- ============================================
-- 5. Kiểm tra kết quả
-- ============================================
SELECT 'Auth tables created successfully' as status;
SELECT * FROM users;
