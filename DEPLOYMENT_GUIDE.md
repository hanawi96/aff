# Hướng Dẫn Deploy Lên GitHub

## Tự Động (Khuyến Nghị)

### Cách 1: Sử dụng PowerShell (Windows)
```powershell
# Chạy PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\deploy-to-github.ps1
```

### Cách 2: Sử dụng Command Prompt (Windows)
```cmd
deploy-to-github.bat
```

## Thủ Công

### Bước 1: Clone repository
```bash
git clone https://github.com/hanawi96/ref.git
cd ref
```

### Bước 2: Xóa files cũ
```bash
# Xóa tất cả files (trừ .git)
git rm -r *
```

### Bước 3: Copy files mới
Copy các files sau vào thư mục repository:
- index.html
- script.js
- google-apps-script.js
- wrangler.toml
- _worker.js
- README.md

### Bước 4: Commit và push
```bash
git add .
git commit -m "Replace with new Referral Form - Me & Be Affiliate project"
git push origin main
```

## Yêu Cầu

1. **Git** phải được cài đặt
2. **GitHub credentials** đã được cấu hình
3. **Quyền write** trên repository

## Lưu Ý

- Script sẽ tự động backup và restore nếu có lỗi
- Tất cả files cũ sẽ bị xóa và thay thế
- Repository history sẽ được giữ nguyên

## Kiểm Tra Kết Quả

Sau khi deploy thành công, truy cập:
https://github.com/hanawi96/ref

Bạn sẽ thấy:
- ✅ 6 files mới
- ✅ README.md được cập nhật
- ✅ Commit message mới

## Troubleshooting

### Lỗi Git không tìm thấy
```bash
# Cài đặt Git
winget install Git.Git
# Hoặc tải từ: https://git-scm.com/
```

### Lỗi Authentication
```bash
# Cấu hình GitHub credentials
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Hoặc sử dụng GitHub CLI
gh auth login
```

### Lỗi Permission Denied
```bash
# Kiểm tra quyền trên repository
# Đảm bảo bạn có quyền write
```