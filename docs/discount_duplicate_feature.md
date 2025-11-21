# 📋 Tính Năng Sao Chép Mã Giảm Giá

## 🎯 Tổng Quan

Tính năng **Sao chép mã giảm giá** cho phép admin nhanh chóng tạo mã mới dựa trên mã hiện có, tiết kiệm thời gian và đảm bảo tính nhất quán.

## 🚀 Cách Sử Dụng

### 1. Truy Cập Chức Năng

**Vị trí:** Cột "Thao tác" trong bảng danh sách mã giảm giá

**Icon:** 📋 (Copy icon màu tím)

**Cách dùng:**
1. Tìm mã giảm giá muốn sao chép
2. Click vào icon 📋 "Sao chép" ở cột thao tác
3. Modal sẽ mở với dữ liệu đã được điền sẵn
4. Kiểm tra và điều chỉnh thông tin (nếu cần)
5. Click "Lưu mã giảm giá"

### 2. Các Trường Được Tự Động Điều Chỉnh

Khi sao chép, hệ thống tự động điều chỉnh các trường sau (được tô sáng màu tím):

#### a) Mã Giảm Giá (Code)
**Logic tạo mã mới:**
1. Thử `{MÃ_CŨ}_COPY`
   - VD: `GIAM50K` → `GIAM50K_COPY`
2. Nếu đã tồn tại, thử `{MÃ_CŨ}_COPY2`, `_COPY3`, ...
   - VD: `GIAM50K_COPY2`, `GIAM50K_COPY3`
3. Nếu vẫn trùng (sau 100 lần thử), dùng timestamp
   - VD: `GIAM50K_123456`

**Đặc điểm:**
- Tự động loại bỏ suffix cũ (`_COPY`, `_2`, etc.)
- Đảm bảo mã mới unique
- Giữ nguyên format uppercase

#### b) Tiêu Đề (Title)
**Logic:**
- Thêm suffix `(Copy)` vào cuối tiêu đề
- VD: `Giảm 50K cho đơn từ 500K` → `Giảm 50K cho đơn từ 500K (Copy)`

**Lý do:**
- Dễ phân biệt với mã gốc
- Nhắc nhở admin cần đổi tên

#### c) Ngày Bắt Đầu (Start Date)
**Logic:**
- Set = Ngày hôm nay

**Lý do:**
- Mã mới thường có hiệu lực ngay
- Tránh set ngày quá khứ

#### d) Ngày Hết Hạn (Expiry Date)
**Logic:**
- Set = Hôm nay + 30 ngày

**Lý do:**
- Thời gian hợp lý cho campaign
- Admin có thể điều chỉnh dễ dàng

### 3. Các Trường Được Giữ Nguyên

Tất cả thông tin khác được copy y nguyên:

- ✅ Loại giảm giá (fixed/percentage/gift/freeship)
- ✅ Giá trị giảm
- ✅ Giá trị tối đa (cho percentage)
- ✅ Thông tin quà tặng
- ✅ Điều kiện áp dụng (min order, min items)
- ✅ Giới hạn sử dụng (max uses)
- ✅ Trạng thái hiển thị (visible)
- ✅ Mô tả

### 4. Các Trường Được Reset

Một số trường được reset về giá trị mặc định:

- 🔄 **ID:** Rỗng (tạo mã mới)
- 🔄 **Usage Count:** 0 (chưa được dùng)
- 🔄 **Total Discount Amount:** 0 (chưa giảm tiền)
- 🔄 **Active:** true (kích hoạt sẵn)

## 💡 Use Cases

### 1. Tạo Campaign Mới Từ Campaign Cũ
**Scenario:** Bạn có campaign "GIAM50K" thành công, muốn tạo campaign tương tự cho tháng sau

**Steps:**
1. Click sao chép "GIAM50K"
2. Đổi mã thành "GIAM50K_T12" (tháng 12)
3. Đổi tiêu đề: "Giảm 50K - Tháng 12"
4. Kiểm tra ngày hết hạn
5. Lưu

**Kết quả:** Campaign mới với cùng điều kiện, chỉ khác mã và thời gian

### 2. Tạo Biến Thể Của Mã Hiện Có
**Scenario:** Có mã "GIAM10%" cho tất cả, muốn tạo "GIAM15%" cho VIP

**Steps:**
1. Click sao chép "GIAM10%"
2. Đổi mã thành "GIAM15VIP"
3. Đổi giá trị từ 10% → 15%
4. Thêm điều kiện cho khách VIP (nếu có)
5. Lưu

**Kết quả:** Mã mới với giá trị cao hơn cho segment khác

### 3. Tạo Mã Test
**Scenario:** Muốn test mã giảm giá trước khi public

**Steps:**
1. Click sao chép mã production
2. Đổi mã thành "TEST_GIAM50K"
3. Bỏ check "Hiển thị công khai"
4. Set số lần dùng = 5
5. Lưu

**Kết quả:** Mã test với cùng logic, không hiển thị công khai

### 4. Tạo Mã Cho Nhiều Kênh
**Scenario:** Cùng campaign nhưng khác mã cho từng kênh (Facebook, Zalo, Website)

**Steps:**
1. Click sao chép mã gốc
2. Đổi mã: "GIAM50K_FB", "GIAM50K_ZALO", "GIAM50K_WEB"
3. Giữ nguyên tất cả điều kiện
4. Lưu từng mã

**Kết quả:** Track được hiệu quả từng kênh marketing

## 🎨 UI/UX Features

### 1. Visual Indicators

**Modal Title:**
```
📋 Sao chép mã giảm giá
Sao chép từ: GIAM50K
```

**Highlighted Fields:**
- Các trường được tự động điều chỉnh có:
  - Border màu tím (ring-2 ring-purple-400)
  - Background màu tím nhạt (bg-purple-50)
  - Highlight tự động mất sau 3 giây

**Toast Notification:**
```
ℹ️ Đã sao chép mã. Các trường được tô sáng đã được tự động điều chỉnh
```

### 2. Button Design

**Icon:** Copy/Duplicate icon (2 overlapping squares)
**Color:** Purple (#9333ea)
**Position:** Cột thao tác, trước nút "Chỉnh sửa"
**Hover:** Purple background (#f3e8ff)

### 3. Smart Defaults

**Expiry Date:**
- Tự động set = Today + 30 days
- Hiển thị trong date picker
- Admin có thể điều chỉnh dễ dàng

**Code Generation:**
- Thông minh, tránh trùng lặp
- Giữ nguyên format gốc
- Dễ nhận biết là bản copy

## 🔧 Technical Implementation

### 1. Function: `duplicateDiscount(id)`

**Purpose:** Mở modal với dữ liệu đã được điều chỉnh

**Logic:**
```javascript
function duplicateDiscount(id) {
    // 1. Find original discount
    const discount = allDiscounts.find(d => d.id === id);
    
    // 2. Set modal title & subtitle
    document.getElementById('modalTitle').textContent = '📋 Sao chép mã giảm giá';
    document.getElementById('modalSubtitle').textContent = `Sao chép từ: ${discount.code}`;
    
    // 3. Generate unique code
    let newCode = generateUniqueCode(discount.code);
    
    // 4. Fill form with adjusted data
    document.getElementById('code').value = newCode;
    document.getElementById('title').value = `${discount.title} (Copy)`;
    // ... copy other fields ...
    
    // 5. Set smart dates
    const today = new Date();
    const expiryDate = new Date(today);
    expiryDate.setDate(expiryDate.getDate() + 30);
    
    // 6. Highlight adjusted fields
    highlightField('code');
    highlightField('title');
    highlightField('startDate');
    highlightField('expiryDate');
    
    // 7. Show toast
    showToast('Đã sao chép mã...', 'info', 5000);
}
```

### 2. Function: `generateUniqueCode(originalCode)`

**Purpose:** Tạo mã unique từ mã gốc

**Algorithm:**
```javascript
function generateUniqueCode(originalCode) {
    // Step 1: Remove existing suffixes
    let baseCode = originalCode.replace(/_COPY\d*$|_\d+$/, '');
    
    // Step 2: Try _COPY
    let newCode = `${baseCode}_COPY`;
    if (!codeExists(newCode)) return newCode;
    
    // Step 3: Try _COPY2, _COPY3, ...
    for (let i = 2; i < 100; i++) {
        newCode = `${baseCode}_COPY${i}`;
        if (!codeExists(newCode)) return newCode;
    }
    
    // Step 4: Fallback to timestamp
    return `${baseCode}_${Date.now().toString().slice(-6)}`;
}
```

**Edge Cases Handled:**
- ✅ Mã đã có suffix `_COPY` → Remove và thêm lại
- ✅ Mã đã có suffix `_2`, `_3` → Remove và thêm `_COPY`
- ✅ Trùng lặp nhiều lần → Dùng timestamp
- ✅ Base code quá dài → Vẫn hoạt động (không truncate)

### 3. Function: `highlightField(fieldId)`

**Purpose:** Tô sáng trường đã được điều chỉnh

**Implementation:**
```javascript
function highlightField(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    // Add highlight
    field.classList.add('ring-2', 'ring-purple-400', 'bg-purple-50');
    
    // Auto-remove after 3s
    setTimeout(() => {
        field.classList.remove('ring-2', 'ring-purple-400', 'bg-purple-50');
    }, 3000);
}
```

**CSS Classes:**
- `ring-2`: Border 2px
- `ring-purple-400`: Purple color
- `bg-purple-50`: Light purple background

## 📊 Benefits

### For Admin Users
- ⚡ Tiết kiệm thời gian (không cần nhập lại tất cả)
- 🎯 Đảm bảo tính nhất quán (copy từ mã đã test)
- 🔄 Dễ dàng tạo biến thể
- 📋 Tạo nhiều mã cùng lúc cho các kênh khác nhau
- ✅ Giảm lỗi nhập liệu

### For System
- 🏗️ Code reusability
- 🔒 Đảm bảo unique constraint
- 📈 Tăng productivity
- 🎨 Better UX với visual feedback
- 🚀 Faster campaign deployment

## 🧪 Testing Checklist

### Basic Functionality
- [ ] Click nút sao chép → Modal mở
- [ ] Mã mới được tạo tự động (unique)
- [ ] Tiêu đề có suffix "(Copy)"
- [ ] Ngày bắt đầu = hôm nay
- [ ] Ngày hết hạn = hôm nay + 30 ngày
- [ ] Các trường khác giữ nguyên
- [ ] Lưu thành công → Mã mới xuất hiện trong danh sách

### Code Generation
- [ ] Mã gốc: `GIAM50K` → `GIAM50K_COPY`
- [ ] Đã có `_COPY` → `GIAM50K_COPY2`
- [ ] Đã có `_COPY2` → `GIAM50K_COPY3`
- [ ] Mã có số: `GIAM50K_2` → `GIAM50K_COPY`
- [ ] Trùng 100 lần → Dùng timestamp

### UI/UX
- [ ] Subtitle hiển thị mã gốc
- [ ] 4 trường được highlight màu tím
- [ ] Highlight tự động mất sau 3s
- [ ] Toast notification hiển thị
- [ ] Icon màu tím, hover effect đúng

### Edge Cases
- [ ] Sao chép mã đã hết hạn → Ngày mới vẫn đúng
- [ ] Sao chép mã đã tạm dừng → Mã mới active
- [ ] Sao chép mã có quà tặng → Thông tin quà giữ nguyên
- [ ] Sao chép mã có điều kiện phức tạp → Điều kiện giữ nguyên

## 🔮 Future Enhancements

### Planned Features
- [ ] Bulk duplicate (sao chép nhiều mã cùng lúc)
- [ ] Template system (lưu template để tạo nhanh)
- [ ] Smart suggestions (gợi ý mã dựa trên pattern)
- [ ] Duplicate with modifications (chọn trường nào cần thay đổi)
- [ ] Version history (xem lịch sử sao chép)

### Advanced Features
- [ ] Duplicate to different campaign
- [ ] Duplicate with date range adjustment
- [ ] Duplicate with value scaling (VD: 10% → 15% → 20%)
- [ ] Duplicate with A/B testing setup
- [ ] Duplicate with automatic scheduling

## 💡 Tips & Best Practices

### 1. Naming Convention
**Recommended patterns:**
- `{BASE}_{CHANNEL}` - VD: `GIAM50K_FB`, `GIAM50K_ZALO`
- `{BASE}_{MONTH}` - VD: `GIAM50K_T12`, `GIAM50K_T1`
- `{BASE}_{SEGMENT}` - VD: `GIAM50K_VIP`, `GIAM50K_NEW`
- `{BASE}_{VERSION}` - VD: `GIAM50K_V2`, `GIAM50K_V3`

### 2. When to Use Duplicate
**✅ Good use cases:**
- Tạo campaign mới tương tự campaign cũ
- Tạo biến thể với giá trị khác
- Tạo mã cho nhiều kênh marketing
- Tạo mã test từ mã production

**❌ Avoid:**
- Sao chép quá nhiều lần (gây rối)
- Không đổi tên/mã (gây nhầm lẫn)
- Sao chép mã có vấn đề (nên fix gốc trước)

### 3. After Duplicating
**Checklist:**
1. ✅ Đổi mã cho phù hợp
2. ✅ Đổi tiêu đề (bỏ "(Copy)")
3. ✅ Kiểm tra ngày hết hạn
4. ✅ Kiểm tra điều kiện áp dụng
5. ✅ Test mã trước khi public

## 📝 Changelog

### Version 1.0.0 (21/11/2025)
- ✅ Initial release
- ✅ Smart code generation
- ✅ Auto-adjust dates
- ✅ Visual highlights
- ✅ Toast notifications
- ✅ Subtitle with original code

---

**Feature Owner:** Kiro AI Assistant  
**Last Updated:** 21/11/2025  
**Status:** ✅ Production Ready  
**Version:** 1.0.0
