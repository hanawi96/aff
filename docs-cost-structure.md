# 📊 CẤU TRÚC CHI PHÍ - PHƯƠNG ÁN A

## 🎯 Tổng quan:
Hệ thống phân loại chi phí thành **6 nhóm chính** để dễ quản lý và tối ưu.

---

## 📋 6 NHÓM CHI PHÍ CHÍNH (Biểu đồ Pie Chart):

### 1. 💎 **Giá vốn sản phẩm** (Product Cost)
- **Màu:** Xanh dương đậm `#3B82F6`
- **Nguồn:** `costs.product_cost`
- **Tính từ:** `order_items.product_cost × quantity`
- **Mô tả:** Chi phí nhập hàng, giá gốc sản phẩm
- **Tỷ trọng thường:** 45-55%
- **Tối ưu:** Đàm phán với nhà cung cấp, mua số lượng lớn

### 2. 🚚 **Vận chuyển** (Shipping Cost)
- **Màu:** Cam `#F97316`
- **Nguồn:** `costs.shipping_cost`
- **Tính từ:** `orders.shipping_cost` (chi phí thực tế trả đơn vị vận chuyển)
- **Mô tả:** Phí ship thực tế (không phải phí ship thu từ khách)
- **Tỷ trọng thường:** 12-18%
- **Tối ưu:** Đàm phán với đơn vị vận chuyển, gom đơn

### 3. 📦 **Vật liệu đóng gói** (Packaging Materials)
- **Màu:** Tím `#8B5CF6`
- **Nguồn:** Tổng của:
  - `costs.bag_zip` (Túi zip)
  - `costs.bag_red` (Túi đỏ)
  - `costs.box_shipping` (Hộp đóng gói)
  - `costs.red_string` (Dây đỏ)
  - `costs.thank_card` (Thiệp cảm ơn)
  - `costs.paper_print` (Giấy in)
- **Mô tả:** Tất cả vật liệu dùng để đóng gói sản phẩm
- **Tỷ trọng thường:** 6-10%
- **Tối ưu:** Mua sỉ, tìm nhà cung cấp giá tốt

### 4. 👷 **Tiền công đóng gói** (Labor Cost)
- **Màu:** Vàng `#F59E0B`
- **Nguồn:** `costs.labor_cost`
- **Tính từ:** `packaging_details.per_product.labor_cost × total_products`
- **Mô tả:** Chi phí nhân công đóng gói sản phẩm
- **Tỷ trọng thường:** 3-5%
- **Tối ưu:** Tăng năng suất, đào tạo nhân viên

### 5. 💰 **Hoa hồng CTV** (Commission)
- **Màu:** Xanh lá `#10B981`
- **Nguồn:** `costs.commission`
- **Tính từ:** `orders.commission` (dựa trên `ctv.commission_rate`)
- **Mô tả:** Hoa hồng trả cho cộng tác viên
- **Tỷ trọng thường:** 8-12%
- **Tối ưu:** Điều chỉnh tỷ lệ hoa hồng theo hiệu suất

### 6. 📊 **Thuế** (Tax)
- **Màu:** Đỏ `#EF4444`
- **Nguồn:** `costs.tax`
- **Tính từ:** `orders.tax_amount` (mặc định 1.5% doanh thu)
- **Mô tả:** Thuế kinh doanh
- **Tỷ trọng thường:** 1.5-2%
- **Tối ưu:** Không thể tối ưu (bắt buộc)

---

## 📊 BẢNG CHI TIẾT (11 dòng):

### **Nhóm 1: Chi phí chính (4 dòng)**
1. 💎 Giá vốn sản phẩm
2. 🚚 Chi phí vận chuyển
3. 💰 Hoa hồng CTV
4. 📊 Thuế (1.5%)

### **Nhóm 2: Chi phí đóng gói (7 dòng)**
5. 📦 Túi zip
6. 🎁 Túi đỏ
7. 📦 Hộp đóng gói
8. 🧵 Dây đỏ
9. 💌 Thiệp cảm ơn
10. 📄 Giấy in
11. 👷 Tiền công đóng gói

---

## 🎨 MÀU SẮC PALETTE:

```javascript
const colors = {
    product_cost: '#3B82F6',    // Xanh dương đậm
    shipping_cost: '#F97316',   // Cam
    packaging: '#8B5CF6',       // Tím
    labor_cost: '#F59E0B',      // Vàng
    commission: '#10B981',      // Xanh lá
    tax: '#EF4444'              // Đỏ
};
```

---

## 📈 TỶ TRỌNG CHUẨN (Tham khảo):

| Chi phí | Tỷ trọng lý tưởng | Cảnh báo nếu |
|---------|-------------------|--------------|
| Giá vốn | 40-50% | > 55% |
| Vận chuyển | 10-15% | > 20% |
| Vật liệu đóng gói | 5-8% | > 10% |
| Tiền công | 3-5% | > 7% |
| Hoa hồng CTV | 8-12% | > 15% |
| Thuế | 1.5-2% | > 3% |

---

## 💡 INSIGHT TỰ ĐỘNG:

### **Nếu Giá vốn > 50%:**
```
⚠️ Giá vốn chiếm 52% tổng chi phí (cao!)
💡 Đề xuất:
- Tìm nhà cung cấp giá tốt hơn
- Tăng giá bán 5-10%
- Mua số lượng lớn để được giảm giá
```

### **Nếu Vận chuyển > 15%:**
```
⚠️ Chi phí vận chuyển chiếm 18% (cao!)
💡 Đề xuất:
- Đàm phán với đơn vị vận chuyển
- Gom đơn để giảm chi phí
- Tìm đơn vị vận chuyển giá tốt hơn
```

### **Nếu Hoa hồng > 12%:**
```
⚠️ Hoa hồng CTV chiếm 15% (cao!)
💡 Đề xuất:
- Xem xét điều chỉnh tỷ lệ hoa hồng
- Áp dụng hoa hồng theo bậc
- Tăng giá bán để bù đắp
```

---

## 🔧 CẤU HÌNH KỸ THUẬT:

### **API Endpoint:**
```
GET /api?action=getDetailedAnalytics&period=all
```

### **Response Structure:**
```json
{
  "cost_breakdown": {
    "product_cost": 80000,
    "shipping_cost": 25000,
    "commission": 15000,
    "tax": 10150,
    "bag_zip": 5000,
    "bag_red": 3000,
    "box_shipping": 8000,
    "red_string": 2550,
    "thank_card": 2000,
    "paper_print": 1000,
    "labor_cost": 2000
  }
}
```

### **Pie Chart Data:**
```javascript
[
  { label: '💎 Giá vốn sản phẩm', value: 80000, color: '#3B82F6' },
  { label: '🚚 Vận chuyển', value: 25000, color: '#F97316' },
  { label: '📦 Vật liệu đóng gói', value: 21550, color: '#8B5CF6' },
  { label: '👷 Tiền công đóng gói', value: 2000, color: '#F59E0B' },
  { label: '💰 Hoa hồng CTV', value: 15000, color: '#10B981' },
  { label: '📊 Thuế', value: 10150, color: '#EF4444' }
]
```

---

## ✅ ƯU ĐIỂM PHƯƠNG ÁN A:

1. ✅ **Đầy đủ thông tin** - Có đủ 6 loại chi phí quan trọng
2. ✅ **Dễ hiểu** - Mỗi loại có ý nghĩa rõ ràng
3. ✅ **Dễ tối ưu** - Biết chính xác cần giảm chi phí nào
4. ✅ **Cân bằng** - Không quá chi tiết, không quá chung chung
5. ✅ **Phù hợp mô hình CTV** - Có riêng mục "Hoa hồng CTV"
6. ✅ **Biểu đồ đẹp** - 6 phần vừa đủ, không rối mắt

---

## 🚀 KẾT QUẢ:

Bây giờ bạn có thể:
- 👀 Nhìn biểu đồ → Biết ngay chi phí nào chiếm nhiều nhất
- 📊 Xem bảng → Biết chi tiết từng khoản nhỏ
- 💡 Ra quyết định → Tối ưu đúng chỗ cần thiết
- 📈 Tăng lợi nhuận → Giảm chi phí hiệu quả

**Ví dụ thực tế:**
- Thấy "Giá vốn 52%" → Tìm nhà cung cấp mới
- Thấy "Vận chuyển 18%" → Đàm phán giá ship
- Thấy "Tiền công 6%" → Tối ưu quy trình đóng gói
