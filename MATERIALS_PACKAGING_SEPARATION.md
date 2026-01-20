# Tách biệt Nguyên liệu và Chi phí đóng gói

## 📋 Tổng quan

Hệ thống quản lý 2 loại chi phí khác nhau:
1. **Nguyên liệu sản phẩm**: Bi bạc, dây, charm... (thay đổi theo từng sản phẩm)
2. **Chi phí đóng gói**: Túi zip, hộp carton... (cố định cho tất cả đơn hàng)

## 🎯 Giải pháp

### Quản lý tập trung tại trang Materials
- Tất cả chi phí (nguyên liệu + đóng gói) được quản lý ở **1 nơi duy nhất**: Trang Materials
- Phân loại bằng **Categories**:
  - 💎 Đá quý (bi bạc, hổ phách...)
  - 🧵 Dây (dây cước, dây ngũ sắc...)
  - ✨ Charm/Mặt (charm rắn, rồng...)
  - 🔔 Phụ kiện (chuông, thẻ tên...)
  - 📦 **Khác** (túi zip, hộp carton, phí ship...)

### Lọc thông minh trong modal chọn nguyên liệu
- Khi chọn nguyên liệu cho sản phẩm → **Tự động lọc bỏ** category "Khác"
- Chỉ hiển thị nguyên liệu thật sự (đá, dây, charm...)
- Tránh nhầm lẫn: không cho phép thêm túi zip vào công thức vòng

## 💻 Implementation

### Code thay đổi
**File**: `public/assets/js/product-materials.js`

```javascript
// Filter out already selected materials AND packaging costs
const availableMaterials = allMaterialsForProduct.filter(m => 
    !selectedMaterials.some(sm => sm.material_name === m.item_name) &&
    m.category_name !== 'khac' // Lọc bỏ chi phí đóng gói
);
```

### Database structure
**Bảng**: `cost_config` (hoặc `materials` nếu đã rename)

```sql
-- Nguyên liệu sản phẩm (hiển thị trong modal)
| id  | item_name       | item_cost | category_id | category_name |
|-----|-----------------|-----------|-------------|---------------|
| 99  | bi_bac_3ly_s999 | 15000     | 1           | da_quy        |
| 104 | day_cuoc        | 5000      | 2           | day           |
| 107 | charm_ran       | 12000     | 3           | charm         |

-- Chi phí đóng gói (KHÔNG hiển thị trong modal)
| id  | item_name       | item_cost | category_id | category_name |
|-----|-----------------|-----------|-------------|---------------|
| 1   | bag_zip         | 200       | 5           | khac          |
| 4   | hop_carton      | 950       | 5           | khac          |
| 119 | bang_dinh       | 200       | 5           | khac          |
```

## 🔄 Workflow

### 1. Quản lý giá (Admin)
```
Trang Materials → Xem tất cả → Chỉnh sửa giá
- Bi bạc 3ly: 15,000đ
- Túi zip: 200đ
- Hộp carton: 950đ
```

### 2. Tạo công thức sản phẩm (Admin)
```
Modal Chọn nguyên liệu → Chỉ thấy:
✅ Bi bạc 3ly
✅ Dây cước
✅ Charm rắn
❌ Túi zip (bị lọc)
❌ Hộp carton (bị lọc)
```

### 3. Tính giá vốn sản phẩm
```javascript
// Chỉ tính từ nguyên liệu thật
cost_price = (7 × 15000) + (18 × 5000) + (1 × 12000)
           = 105000 + 90000 + 12000
           = 207,000đ
```

### 4. Tính chi phí đơn hàng
```javascript
// Tính riêng packaging cost
packaging_cost = bag_zip + hop_carton + bang_dinh + labor_cost
               = 200 + 950 + 200 + 8000
               = 9,350đ

// Tổng chi phí
total_cost = (cost_price × quantity) + packaging_cost + shipping_cost
```

## ✅ Lợi ích

1. **Tách biệt rõ ràng**
   - Nguyên liệu: Thành phần sản phẩm
   - Đóng gói: Chi phí chung

2. **Tránh nhầm lẫn**
   - User không thấy túi zip khi chọn nguyên liệu cho vòng
   - Rõ ràng về mục đích từng loại chi phí

3. **Dễ bảo trì**
   - Đổi giá túi zip: Chỉ sửa 1 chỗ trong Materials
   - Không cần update công thức từng sản phẩm

4. **Tính toán chính xác**
   - Giá vốn sản phẩm: Chỉ từ nguyên liệu
   - Chi phí đóng gói: Tính riêng theo đơn hàng
   - Không bị tính trùng

## 📝 Notes

- Category "Khác" vẫn tồn tại trong database
- Vẫn hiển thị trong trang Materials để quản lý
- Chỉ bị lọc bỏ trong modal chọn nguyên liệu
- Có thể thêm category mới nếu cần (VD: "Bao bì", "Vận chuyển"...)

## 🔮 Mở rộng tương lai

Nếu cần tách riêng hoàn toàn:
1. Tạo category mới: "dong_goi" 
2. Di chuyển các item từ "khac" sang "dong_goi"
3. Tạo trang Settings riêng cho đóng gói
4. Lọc cả 2 category: `khac` và `dong_goi`

Nhưng hiện tại giải pháp đơn giản này đã đủ tốt!
