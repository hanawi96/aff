# ✅ Pre-flight Checklist - Image Migration to R2

## Before Starting

### 1. Environment Check
- [x] R2 bucket exists: `vdt-image`
- [x] Wrangler CLI installed and authenticated
- [x] Environment variables set (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)
- [x] Database connection working

### 2. Files Generated
- [x] `migrations/r2-upload-commands.sh` (149 commands)
- [x] `migrations/image-url-mapping.json` (149 mappings)
- [x] `migrations/upload-to-r2.ps1` (PowerShell script)
- [x] `scripts/update-image-urls-in-db.js` (Database update script)

### 3. Data Verification
- [x] Total images: 149 files
- [x] Total size: 14.40 MB
- [x] Current database URLs: `./assets/images/...` format
- [x] Mapping supports both `./` and `../` patterns

### 4. Backup
- [ ] **IMPORTANT**: Backup database before proceeding
  ```bash
  # Create backup
  wrangler d1 export vdt --output=backups/db_before_r2_migration.sql
  ```

## Migration Steps

### Step 1: Upload Images to R2
```powershell
# Run PowerShell script (recommended)
.\migrations\upload-to-r2.ps1

# OR run commands manually
Get-Content migrations\r2-upload-commands.sh | ForEach-Object { Invoke-Expression $_ }
```

**Expected time**: 5-10 minutes  
**Expected result**: 149 files uploaded to R2

### Step 2: Verify Upload
```powershell
# Check a few random images
wrangler r2 object get vdt-image/assets/images/banner.webp
wrangler r2 object get vdt-image/assets/images/product_img/tat-ca-mau.webp
```

**OR** visit URLs in browser:
- https://6732e495e6dc332a4d51e0aba6c0408a.r2.cloudflarestorage.com/vdt-image/assets/images/banner.webp
- https://6732e495e6dc332a4d51e0aba6c0408a.r2.cloudflarestorage.com/vdt-image/assets/images/product_img/tat-ca-mau.webp

### Step 3: Update Database URLs
```bash
node scripts/update-image-urls-in-db.js
```

**Expected result**: All product image URLs updated from local to R2

### Step 4: Verify Website
1. Open admin panel: https://ctv-api.yendev96.workers.dev/admin/products.html
2. Check product images display correctly
3. Try editing a product - image should show
4. Try uploading a new image - should work

### Step 5: Final Verification
```bash
node scripts/check-current-image-urls.js
```

**Expected result**: All URLs should show "✅ R2"

## Rollback Plan (If Something Goes Wrong)

### Option 1: Restore Database
```bash
# Restore from backup
wrangler d1 execute vdt --file=backups/db_before_r2_migration.sql
```

### Option 2: Manual Revert
```sql
-- Revert all R2 URLs back to local
UPDATE products 
SET image_url = REPLACE(image_url, 
    'https://6732e495e6dc332a4d51e0aba6c0408a.r2.cloudflarestorage.com/vdt-image/', 
    './'
)
WHERE image_url LIKE '%r2.cloudflarestorage.com%';
```

## Post-Migration (Optional)

### Cleanup Local Files
**⚠️ ONLY after confirming everything works!**

```powershell
# Backup first
xcopy public\assets\images backups\images_backup\ /E /I

# Then delete (CAREFUL!)
# rmdir /s /q public\assets\images\product_img
```

## Troubleshooting

### Issue: Upload fails
- Check internet connection
- Check wrangler authentication: `wrangler whoami`
- Try uploading one file manually to test

### Issue: Database update fails
- Check environment variables
- Check database connection
- Check mapping file exists

### Issue: Images don't display
- Check R2 bucket public access settings
- Check URL format in database
- Check browser console for errors

## Contact
If you encounter issues, check:
- `docs/MIGRATE_IMAGES_GUIDE.md` - Detailed guide
- `docs/R2_IMAGE_UPLOAD.md` - R2 setup documentation
