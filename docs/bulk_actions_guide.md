# 📦 Hướng Dẫn Bulk Actions - Quản Lý Mã Giảm Giá

## 🎯 Tổng Quan

Tính năng **Bulk Actions** cho phép bạn thực hiện các thao tác hàng loạt trên nhiều mã giảm giá cùng lúc, tiết kiệm thời gian và tăng hiệu quả quản lý.

## 🚀 Cách Sử Dụng

### 1. Chọn Mã Giảm Giá

**Chọn từng mã:**
- Click vào checkbox ở cột đầu tiên của mỗi hàng
- Checkbox sẽ được đánh dấu ✓
- Số lượng mã đã chọn sẽ hiển thị trên bulk action bar

**Chọn tất cả:**
- Click vào checkbox ở header (cột đầu tiên)
- Tất cả mã trên trang hiện tại sẽ được chọn
- Click lại để bỏ chọn tất cả

### 2. Bulk Action Bar

Khi bạn chọn ít nhất 1 mã, một thanh công cụ sẽ xuất hiện ở **bottom center** màn hình với:

**Hiển thị:**
- 🔵 Icon check + số lượng mã đã chọn (VD: "5 mã")

**Các nút action:**
1. **▶️ Kích hoạt** (Xanh lá) - Kích hoạt các mã đã chọn
2. **⏸️ Tạm dừng** (Cam) - Tạm dừng các mã đã chọn
3. **📥 Export** (Trắng) - Export các mã ra file CSV
4. **🗑️ Xóa** (Đỏ) - Xóa các mã đã chọn
5. **✖️ Đóng** - Bỏ chọn tất cả

## 📋 Chi Tiết Các Thao Tác

### ▶️ Kích Hoạt Hàng Loạt

**Mục đích:** Kích hoạt nhiều mã cùng lúc để cho phép khách hàng sử dụng

**Cách dùng:**
1. Chọn các mã cần kích hoạt
2. Click nút "Kích hoạt" (màu xanh lá)
3. Xác nhận trong dialog
4. Hệ thống sẽ kích hoạt tất cả mã đã chọn

**Kết quả:**
- Mã được kích hoạt → trạng thái "Hoạt động"
- Hiển thị thông báo thành công
- Danh sách tự động refresh
- Selections được clear

**Use case:**
- Kích hoạt nhiều mã khuyến mãi cho dịp lễ
- Bật lại các mã đã tạm dừng
- Kích hoạt mã mới tạo hàng loạt

---

### ⏸️ Tạm Dừng Hàng Loạt

**Mục đích:** Tạm dừng nhiều mã cùng lúc (không cho khách sử dụng)

**Cách dùng:**
1. Chọn các mã cần tạm dừng
2. Click nút "Tạm dừng" (màu cam)
3. Xác nhận trong dialog
4. Hệ thống sẽ tạm dừng tất cả mã đã chọn

**Kết quả:**
- Mã bị tạm dừng → trạng thái "Tạm dừng"
- Khách hàng không thể sử dụng mã này
- Hiển thị thông báo thành công
- Danh sách tự động refresh

**Use case:**
- Tạm dừng mã hết ngân sách
- Dừng mã khi kết thúc chương trình
- Tạm dừng mã có vấn đề

---

### 📥 Export Hàng Loạt

**Mục đích:** Xuất thông tin các mã ra file CSV để lưu trữ hoặc báo cáo

**Cách dùng:**
1. Chọn các mã cần export
2. Click nút "Export"
3. File CSV sẽ tự động download

**File CSV bao gồm:**
- Mã giảm giá
- Tiêu đề
- Loại (Giảm cố định, Giảm %, Tặng quà, Freeship)
- Giá trị
- Giá trị đơn tối thiểu
- Số lần dùng tối đa
- Đã dùng (số lần)
- Trạng thái
- Ngày hết hạn

**Tên file:** `discounts_[timestamp].csv`  
**Encoding:** UTF-8 with BOM (hiển thị tiếng Việt đúng trong Excel)

**Use case:**
- Backup dữ liệu mã giảm giá
- Báo cáo cho kế toán
- Chia sẻ thông tin với team
- Phân tích hiệu quả khuyến mãi

---

### 🗑️ Xóa Hàng Loạt

**Mục đích:** Xóa vĩnh viễn nhiều mã cùng lúc

**⚠️ CẢNH BÁO:** Hành động này không thể hoàn tác!

**Cách dùng:**
1. Chọn các mã cần xóa
2. Click nút "Xóa" (màu đỏ)
3. Đọc kỹ cảnh báo và xác nhận
4. Hệ thống sẽ xóa các mã đã chọn

**Lưu ý quan trọng:**
- ❌ Không thể xóa mã đã được sử dụng
- ❌ Không thể khôi phục sau khi xóa
- ✅ Chỉ xóa mã chưa từng được dùng

**Kết quả:**
- Mã được xóa khỏi hệ thống
- Hiển thị số lượng xóa thành công
- Hiển thị số lượng không thể xóa (nếu có)
- Danh sách tự động refresh

**Use case:**
- Xóa mã test
- Xóa mã tạo nhầm
- Dọn dẹp mã cũ không dùng

---

### ✖️ Bỏ Chọn Tất Cả

**Mục đích:** Clear tất cả selections hiện tại

**Cách dùng:**
- Click nút "X" trên bulk action bar
- Hoặc click lại checkbox "Select All" ở header

**Kết quả:**
- Tất cả checkbox bỏ chọn
- Bulk action bar biến mất
- Không có thay đổi dữ liệu

## 💡 Tips & Tricks

### 1. Làm việc hiệu quả
- Dùng filter trước khi select all để chọn đúng nhóm mã
- VD: Filter "Loại = Giảm cố định" → Select All → Kích hoạt

### 2. Kiểm tra trước khi xóa
- Export trước khi xóa để backup
- Kiểm tra kỹ danh sách đã chọn
- Đọc kỹ cảnh báo

### 3. Xử lý lỗi
- Nếu có mã không thể xóa → hệ thống sẽ báo số lượng
- Các mã khác vẫn được xử lý bình thường
- Check lại danh sách sau khi thao tác

### 4. Performance
- Chọn tối đa 50-100 mã mỗi lần
- Nếu có nhiều hơn, chia thành nhiều lần
- Tránh chọn quá nhiều để tránh timeout

## 🎨 Giao Diện

### Màu sắc
- **Indigo-Purple Gradient**: Bulk action bar
- **Green**: Nút kích hoạt
- **Orange**: Nút tạm dừng
- **White/Transparent**: Nút export
- **Red**: Nút xóa

### Animation
- Smooth fade in/out khi show/hide bar
- Scale effect khi hover buttons
- Transition mượt mà

### Icons
- ✓ Check circle: Selected count
- ▶️ Play: Kích hoạt
- ⏸️ Pause: Tạm dừng
- 📥 Download: Export
- 🗑️ Trash: Xóa
- ✖️ Close: Clear selection

## 🔧 Keyboard Shortcuts (Planned)

- `Ctrl + A`: Select all
- `Ctrl + D`: Deselect all
- `Delete`: Bulk delete (with confirmation)
- `Escape`: Clear selection

## 📊 Thống Kê

Sau mỗi bulk action, hệ thống sẽ hiển thị:
- ✅ Số lượng thành công
- ❌ Số lượng thất bại (nếu có)
- 📝 Lý do thất bại (nếu có)

## ❓ FAQ

**Q: Tôi có thể chọn mã từ nhiều trang khác nhau không?**  
A: Có, selections được giữ khi bạn chuyển trang hoặc filter.

**Q: Điều gì xảy ra nếu tôi reload trang?**  
A: Tất cả selections sẽ bị clear. Hãy hoàn thành thao tác trước khi reload.

**Q: Tôi có thể undo sau khi xóa không?**  
A: Không. Hành động xóa là vĩnh viễn. Hãy export backup trước khi xóa.

**Q: Bulk action có giới hạn số lượng không?**  
A: Không có giới hạn cứng, nhưng nên chọn tối đa 100 mã mỗi lần để đảm bảo performance.

**Q: Tôi có thể export tất cả mã không?**  
A: Có, click "Select All" rồi click "Export".

## 🆘 Troubleshooting

**Bulk action bar không xuất hiện:**
- Kiểm tra đã chọn ít nhất 1 mã chưa
- Refresh trang và thử lại
- Check console log xem có lỗi không

**Không thể xóa mã:**
- Mã đã được sử dụng không thể xóa
- Dùng "Tạm dừng" thay vì "Xóa"

**Export file không hiển thị tiếng Việt:**
- Mở file bằng Excel
- Import as CSV with UTF-8 encoding
- Hoặc dùng Google Sheets (tự động detect UTF-8)

---

**Version:** 1.0.0  
**Last Updated:** 21/11/2025  
**Developed by:** Kiro AI Assistant
