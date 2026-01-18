# Danh sách địa chỉ test - Pre-scan 2.0

## Cấp độ 1: Cơ bản (Cấu trúc chuẩn, đầy đủ từ khóa)
```
123 Lê Lợi, Phường Bến Thành, Quận 1, TP.HCM
789 Trần Hưng Đạo, Xã Tân Phú, Huyện Đức Hòa, Tỉnh Long An
```

## Cấp độ 2: Trung bình (Thiếu dấu phẩy, viết tắt)
```
88 Quang Trung G/Vấp HCM
595/15f cmt8 p15 quận 10
```

## Cấp độ 3: Khó (Không có dấu phẩy, không có từ khóa ward)
```
Khu phố 3 Tân lập Bắc Tân Uyên Bình Dương
xóm 4 Dong Cao Mê Linh Hà Nội
```

## Cấp độ 4: Rất khó (Tên trùng nhau, nhiều địa danh)
```
xom1 xa thanh long huyện thanh chuong tinh nghe an
thôn Tân Dương xã Nhơn an thị xã An Nhơn tỉnh Bình Định
```

## Cấp độ 5: Cực khó (Có landmark, tên người, tên công ty)
```
ngõ 2 sau đình hậu dưỡng đông anh hà nội
Thuỳ Trang khóm 3 thị trấn Năm Căn Cà Mau
```

## Cấp độ 6: Siêu khó (Địa chỉ đặc biệt, edge cases)
```
135 Nguyễn Văn Linh nối dài Q8 HCM
Tầng 5 tòa nhà Bitexco 2 Hải Triều Q1 HCM
```

## Cấp độ 7: Địa ngục (Sai chính tả, thiếu thông tin, format lạ)
```
P15Q10
HCM Q1 P Ben Thanh 123 Le Loi
```

## Cấp độ 8: Thách thức cuối cùng (Kết hợp nhiều vấn đề)
```
Nguyen Van A 0912345678 123 abc p1 q1 hcm
Nhà bà Hai bên hông chợ xã Tân Lập Đức Hòa Long An
```

## Cấp độ 9: Viết tắt đặc biệt (x., h., tp., tt.)
```
Đông cao x.tráng việt h.mê linh tphn
123 abc x.tân phú h.đức hòa long an
```

## Cấp độ 10: Kết hợp nhiều viết tắt
```
Ấp 2 x.tân phú h.đức hòa t.long an
123 abc p.1 q.1 tp.hcm
```

## Cấp độ 11: Viết tắt không chuẩn (Thiếu dấu chấm)
```
Đông cao x tráng việt h mê linh tp hn
123 abc p 1 q 1 hcm
```

## Cấp độ 12: Viết tắt cực ngắn
```
Xã tân lập bắc tân uyên bd
Phường 1 q1 hcm
```

---

**Tổng cộng: 24 địa chỉ test (2 địa chỉ/cấp độ)**

**Cách test:**
1. Copy từng địa chỉ vào textarea "Phân tích tự động"
2. Bấm nút "Phân tích tự động"
3. Kiểm tra kết quả: Tỉnh, Huyện, Xã, Địa chỉ
4. Đánh dấu ✅ nếu đúng, ❌ nếu sai
