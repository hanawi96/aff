# Cập nhật Form Đăng Ký CTV - Thêm Thông Tin Ngân Hàng

## Tổng quan
Đã thay thế trường "Kinh Nghiệm Bán Hàng Online" bằng 2 trường thông tin ngân hàng:
1. **Số tài khoản** - Input text
2. **Tên ngân hàng** - Dropdown có tìm kiếm (giống modal "Thêm CTV mới")

## Các file đã cập nhật

### 1. public/index.html
**Thay đổi:**
- ❌ Xóa: Dropdown "Kinh Nghiệm Bán Hàng Online" (select với 4 options)
- ✅ Thêm: Grid 2 cột chứa:
  - Input "Số tài khoản" với validation hint (6-20 chữ số)
  - Dropdown "Tên ngân hàng" với tìm kiếm

**Cấu trúc mới:**
```html
<div class="grid md:grid-cols-2 gap-4">
    <!-- Số tài khoản -->
    <div>
        <input type="text" name="bankAccount" placeholder="Nhập số tài khoản">
        <p class="text-xs text-gray-500 mt-1">6-20 chữ số</p>
    </div>

    <!-- Tên ngân hàng -->
    <div>
        <button type="button" id="bankSelectButton">
            <span id="bankSelectedText">Chọn ngân hàng</span>
        </button>
        <input type="hidden" name="bankName" id="bankNameValue">
        
        <!-- Dropdown với search -->
        <div id="bankDropdown" class="hidden fixed z-[9999]">
            <div class="p-3 border-b">
                <input type="text" id="bankSearchInput" placeholder="Tìm kiếm ngân hàng...">
            </div>
            <div class="max-h-60 overflow-y-auto">
                <!-- 18 ngân hàng phổ biến -->
            </div>
        </div>
    </div>
</div>
```

### 2. public/assets/js/referral-form.js
**Thêm mới:**
- Xử lý toggle dropdown ngân hàng
- Tìm kiếm ngân hàng real-time
- Chọn ngân hàng và cập nhật UI
- Đóng dropdown khi click outside
- Keyboard navigation (Arrow Down, Escape)
- Auto-position dropdown (mở lên trên hoặc xuống dưới tùy không gian)

**Tính năng:**
1. **Toggle Dropdown**: Click button để mở/đóng
2. **Search**: Gõ để lọc ngân hàng
3. **Select**: Click option để chọn
4. **Auto-close**: Click outside để đóng
5. **Responsive**: Dropdown tự động điều chỉnh vị trí

## Danh sách Ngân hàng (18 ngân hàng)

1. ABBank - NHTMCP An Binh
2. ACB - NH TMCP A Chau
3. Agribank - NH NN & PTNT Viet Nam
4. BIDV - NH Dau tu & Phat trien VN
5. Eximbank - NHTMCP Xuat Nhap Khau
6. HDBank - NHTMCP phat trien Tp HCM
7. MB - NHTMCP Quan Doi
8. OCB - NHTMCP Phuong Dong
9. Sacombank - NHTMCP Sai Gon Thuong Tin
10. SCB - NHTMCP Sai Gon
11. SHB - NHTMCP Sai Gon - Ha Noi
12. Techcombank - NHTMCP Ky Thuong VN
13. TPBank - NHTMCP Tien Phong
14. VIB - NHTMCP Quoc Te VN
15. Vietcombank - NHTMCP Ngoai Thuong VN
16. VietinBank - NH TMCP Cong Thuong VN
17. VPBank - NHTMCP Viet Nam Thinh Vuong

## Styling

**Theme colors:**
- Primary: `mom-purple` (#d4a5d4)
- Secondary: `mom-blue` (#a8d8ea)
- Hover: `mom-purple/10` (10% opacity)

**Dropdown:**
- Fixed positioning với z-index 9999
- Border radius: rounded-lg
- Shadow: shadow-lg
- Max height: 60 (240px)
- Smooth transitions

## Form Data

Khi submit form, dữ liệu sẽ bao gồm:
```javascript
{
    fullName: "...",
    phone: "...",
    city: "...",
    age: "...",
    bankAccount: "1234567890",      // NEW
    bankName: "Vietcombank",         // NEW
    motivation: "...",
    terms: "on"
}
```

## Validation

**Số tài khoản:**
- Hint: "6-20 chữ số"
- Không có validation tự động (có thể thêm sau)

**Tên ngân hàng:**
- Required: Phải chọn từ dropdown
- Stored in hidden input `bankNameValue`

## Testing

✅ Dropdown mở/đóng đúng
✅ Search filter hoạt động
✅ Chọn ngân hàng cập nhật UI
✅ Click outside đóng dropdown
✅ Form submit bao gồm bank info
✅ Responsive trên mobile
✅ No console errors

## Lưu ý

1. **Demo Mode**: Nếu `CONFIG.DEMO_MODE = true`, form sẽ auto-fill dữ liệu test (không bao gồm bank info)
2. **Backend**: Cần cập nhật API để nhận và lưu `bankAccount` và `bankName`
3. **Validation**: Có thể thêm validation cho số tài khoản (regex: /^\d{6,20}$/)
4. **Required**: Có thể thêm `required` attribute cho các input nếu cần
