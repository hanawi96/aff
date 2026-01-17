# 📚 HỆ THỐNG HỌC ĐỊA CHỈ THÔNG MINH

## 🎯 Mục Tiêu

Hệ thống tự động học từ lịch sử nhập liệu để cải thiện độ chính xác khi nhận diện địa chỉ, đặc biệt với các thôn/xóm không có trong API.

## 🏗️ Kiến Trúc Hệ Thống

### 1. Database Schema

```sql
CREATE TABLE address_learning (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keywords TEXT NOT NULL,              -- Từ khóa trích xuất (vd: "hau duong")
    district_id INTEGER NOT NULL,        -- ID huyện
    ward_id INTEGER NOT NULL,            -- ID phường/xã
    ward_name TEXT NOT NULL,             -- Tên phường/xã
    match_count INTEGER DEFAULT 1,       -- Số lần khớp (confidence)
    last_used_at INTEGER NOT NULL,       -- Timestamp lần cuối dùng
    created_at INTEGER NOT NULL,         -- Timestamp tạo
    UNIQUE(keywords, district_id)        -- Mỗi keyword chỉ map 1 ward/district
);

CREATE INDEX idx_keywords ON address_learning(keywords);
CREATE INDEX idx_district_ward ON address_learning(district_id, ward_id);
CREATE INDEX idx_match_count ON address_learning(match_count DESC);
```

### 2. Keyword Extraction Algorithm

**Input:** Địa chỉ đường phố (street address)
**Output:** Mảng keywords

**Chiến lược:**
1. **Consecutive 2-word phrases** (Tin cậy nhất)
   - "sau đình hậu dưỡng" → ["sau dinh", "dinh hau", "hau duong"]

2. **Consecutive 3-word phrases**
   - "sau đình hậu dưỡng" → ["sau dinh hau", "dinh hau duong"]

3. **Non-consecutive 2-word combinations** (distance ≤3)
   - "sau đình hậu dưỡng" → ["sau hau", "sau duong", "dinh duong"]

**Kết quả:** "sau đình hậu dưỡng" → 8 keywords

### 3. Learning Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER TẠO ĐỚN HÀNG                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  submitNewOrder() - orders-submit.js                        │
│  • Lấy: streetAddress, districtId, wardId, wardName        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  learnFromAddress() - orders-address-learning.js            │
│  • Trích xuất keywords từ streetAddress                     │
│  • Gọi API: POST /learnAddress                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: address-learning-service.js                       │
│  • Lưu/Update database với ON CONFLICT                      │
│  • Tăng match_count nếu đã tồn tại                          │
└─────────────────────────────────────────────────────────────┘
```

### 4. Auto-Fill Flow (Smart Paste)

```
┌─────────────────────────────────────────────────────────────┐
│              USER PASTE ĐỊA CHỈ                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  parseAddress() - orders-smart-paste.js                     │
│  • Nhận diện: Province, District                            │
│  • Trích xuất: earlyStreetAddress                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  PASS 0: Learning Database (Ưu tiên cao nhất)              │
│  • Trích xuất keywords từ earlyStreetAddress                │
│  • Gọi API: GET /searchAddressLearning                      │
│  • Nếu found && confidence >= 2 → RETURN (Skip Pass 1-4)   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ (Nếu không tìm thấy)
┌─────────────────────────────────────────────────────────────┐
│  PASS 1-3: Fuzzy Matching + Hamlet Search                  │
│  • Pass 1: Keyword matching                                 │
│  • Pass 2: Fuzzy matching                                   │
│  • Pass 3: Hamlet name search                               │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Confidence System

| Confidence | Điều Kiện | Hành Động |
|-----------|-----------|-----------|
| 1 | Lần đầu tiên nhập | Lưu vào DB, chưa auto-fill |
| 2 | Lần thứ 2 nhập | Vẫn chưa auto-fill (cần xác nhận) |
| ≥3 | Lần thứ 3+ | **Auto-fill tự động** ✅ |

**Lý do:** Tránh auto-fill sai từ 1 lần nhập nhầm

## 🔧 API Endpoints

### 1. Search Learning Database
```
GET /api?action=searchAddressLearning&keywords=hau+duong,sau+dinh&district_id=250
```

**Response:**
```json
{
  "found": true,
  "ward_id": 8977,
  "ward_name": "Xã Kim Chung",
  "confidence": 3,
  "last_used": 1737097200
}
```

### 2. Learn Address
```
POST /api
Content-Type: application/json

{
  "action": "learnAddress",
  "street_address": "ngõ 2 sau đình hậu dưỡng",
  "district_id": 250,
  "ward_id": 8977,
  "ward_name": "Xã Kim Chung"
}
```

**Response:**
```json
{
  "success": true,
  "keywords_saved": 8,
  "results": [...]
}
```

### 3. Get Statistics
```
GET /api?action=getAddressLearningStats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_mappings": 150,
    "districts_covered": 25,
    "total_matches": 450,
    "max_confidence": 12
  }
}
```

## 📈 Hiệu Suất

### Ví Dụ Thực Tế

**Địa chỉ:** "ngõ 2 sau đình hậu dưỡng đông anh hà nội"

| Lần | Hành Động | Kết Quả |
|-----|-----------|---------|
| 1 | User chọn thủ công: Xã Kim Chung | Lưu vào DB (confidence=1) |
| 2 | User paste lại | Vẫn phải chọn thủ công (confidence=1→2) |
| 3 | User paste lại | **Auto-fill Xã Kim Chung** ✅ (confidence=2→3) |
| 4+ | User paste lại | Auto-fill ngay lập tức (confidence tăng dần) |

### Performance Metrics

- **Pass 0 Speed:** ~50ms (query DB)
- **Pass 1-3 Speed:** ~200-500ms (fuzzy matching + hamlet search)
- **Improvement:** **4-10x nhanh hơn** khi có trong DB

## 🧹 Bảo Trì

### 1. Cleanup Script

Chạy định kỳ để xóa keywords cũ không dùng:

```bash
node scripts/clean-orphaned-keywords.js
```

**Xóa:** Keywords có confidence=1 và không dùng >30 ngày

### 2. Monitoring

Xem thống kê tại: `/admin/address-learning-stats.html`

- Tổng số mappings
- Số huyện đã học
- Top keywords được dùng nhiều nhất
- Confidence trung bình

## 🚀 Roadmap

### Phase 1: Tối Ưu Hiện Tại ✅
- [x] Cải tiến keyword extraction
- [x] Tích hợp Pass 0 vào Smart Paste
- [x] Auto-learn sau khi tạo đơn
- [ ] Thêm admin stats page
- [ ] Cleanup script tự động

### Phase 2: Nâng Cao (1-2 tháng)
- [ ] Keyword weighting (3-word > 2-word)
- [ ] Lưu context (street_prefix)
- [ ] Auto-merge duplicate keywords
- [ ] Dashboard analytics chi tiết

### Phase 3: Machine Learning (3-6 tháng)
- [ ] Học từ user corrections
- [ ] Collaborative filtering
- [ ] Temporal learning (địa chỉ mới/cũ)

## 💡 Best Practices

### 1. Khi Nào Hệ Thống Học?
✅ **Nên:** Sau khi user tạo đơn thành công
❌ **Không:** Khi user đang nhập (chưa xác nhận)

### 2. Làm Sao Tăng Độ Chính Xác?
- Nhập đầy đủ địa chỉ (có thôn/xóm)
- Nhập nhất quán (cùng 1 format)
- Sửa lỗi ngay khi phát hiện

### 3. Xử Lý Conflict
Nếu 1 keyword map đến 2 wards khác nhau:
- Hệ thống chọn ward có `match_count` cao hơn
- Nếu bằng nhau → chọn ward được dùng gần đây nhất

## 🐛 Troubleshooting

### Vấn Đề: Không auto-fill dù đã nhập nhiều lần
**Nguyên nhân:** Confidence < 2
**Giải pháp:** Kiểm tra DB xem keyword có được lưu không

```sql
SELECT * FROM address_learning 
WHERE keywords LIKE '%hau duong%';
```

### Vấn Đề: Auto-fill sai ward
**Nguyên nhân:** Keyword bị conflict (map đến nhiều wards)
**Giải pháp:** 
1. Xóa mapping sai trong DB
2. Nhập lại đúng để tăng confidence của mapping đúng

### Vấn Đề: Database quá lớn
**Nguyên nhân:** Quá nhiều keywords không dùng
**Giải pháp:** Chạy cleanup script

```bash
node scripts/clean-orphaned-keywords.js
```

## 📚 Tài Liệu Tham Khảo

- **Frontend:** `public/assets/js/orders/orders-address-learning.js`
- **Backend:** `src/services/address-learning/address-learning-service.js`
- **Smart Paste:** `public/assets/js/orders/orders-smart-paste.js`
- **Submit:** `public/assets/js/orders/orders-submit.js`
- **Migration:** `database/migrations/036_create_address_learning.sql`

---

**Cập nhật lần cuối:** 2026-01-17
**Version:** 1.0
