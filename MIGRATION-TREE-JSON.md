# Migration: vietnamAddress.json → tree.json

## Lý do Migration

File `vietnamAddress.json` chứa dữ liệu địa chỉ Việt Nam **TRƯỚC năm 2021**, đã lỗi thời:
- ❌ "Thị xã Tân Uyên" (cũ) → ✅ "Thành phố Tân Uyên" (mới, đã lên thành phố)
- ❌ Thiếu "Huyện Bắc Tân Uyên" (mới thành lập)
- ❌ Thiếu nhiều phường/xã mới

File `tree.json` chứa dữ liệu **SAU năm 2021**, cập nhật đầy đủ.

## Thay đổi

### 1. Cấu trúc dữ liệu

#### vietnamAddress.json (cũ)
```json
[
  {
    "Id": "74",
    "Name": "Tỉnh Bình Dương",
    "Districts": [
      {
        "Id": "723",
        "Name": "Thị xã Tân Uyên",
        "Wards": [
          {
            "Id": "25924",
            "Name": "Phường Tân Hiệp"
          }
        ]
      }
    ]
  }
]
```

#### tree.json (mới)
```json
{
  "74": {
    "code": "74",
    "name": "Bình Dương",
    "name_with_type": "Tỉnh Bình Dương",
    "type": "tinh",
    "slug": "binh-duong",
    "quan-huyen": {
      "723": {
        "code": "723",
        "name": "Tân Uyên",
        "name_with_type": "Thành phố Tân Uyên",
        "type": "thanh-pho",
        "slug": "tan-uyen",
        "path": "Tân Uyên, Bình Dương",
        "path_with_type": "Thành phố Tân Uyên, Tỉnh Bình Dương",
        "parent_code": "74",
        "xa-phuong": {
          "25924": {
            "code": "25924",
            "name": "Tân Hiệp",
            "name_with_type": "Phường Tân Hiệp",
            "type": "phuong",
            "slug": "tan-hiep",
            "path": "Tân Hiệp, Tân Uyên, Bình Dương",
            "path_with_type": "Phường Tân Hiệp, Thành phố Tân Uyên, Tỉnh Bình Dương",
            "parent_code": "723"
          }
        }
      }
    }
  }
}
```

### 2. Files đã sửa

#### `public/assets/js/address-selector.js`

**Before:**
```javascript
const basePath = window.location.pathname.includes('/admin/') 
    ? '../assets/data/vietnamAddress.json' 
    : '/assets/data/vietnamAddress.json';

const response = await fetch(basePath);
this.data = await response.json();

// Index data
this.data.forEach(province => {
    this.provinceMap.set(province.Id, province);
    // ...
});
```

**After:**
```javascript
const basePath = window.location.pathname.includes('/admin/') 
    ? '../assets/data/tree.json' 
    : '/assets/data/tree.json';

const response = await fetch(basePath);
this.treeData = await response.json();

// Convert tree.json to array format for compatibility
this.data = [];

Object.entries(this.treeData).forEach(([provinceCode, province]) => {
    const provinceObj = {
        Id: provinceCode,
        Name: province.name_with_type,
        Districts: []
    };
    
    // Index province
    this.provinceMap.set(provinceCode, provinceObj);
    
    // Convert districts
    if (province['quan-huyen']) {
        Object.entries(province['quan-huyen']).forEach(([districtCode, district]) => {
            const districtObj = {
                Id: districtCode,
                Name: district.name_with_type,
                Wards: []
            };
            
            // Index district
            const districtKey = `${provinceCode}-${districtCode}`;
            this.districtMap.set(districtKey, districtObj);
            
            // Convert wards
            if (district['xa-phuong']) {
                Object.entries(district['xa-phuong']).forEach(([wardCode, ward]) => {
                    const wardObj = {
                        Id: wardCode,
                        Name: ward.name_with_type,
                        Level: ward.type
                    };
                    
                    districtObj.Wards.push(wardObj);
                    
                    // Index ward
                    const wardKey = `${provinceCode}-${districtCode}-${wardCode}`;
                    this.wardMap.set(wardKey, wardObj);
                });
            }
            
            provinceObj.Districts.push(districtObj);
        });
    }
    
    this.data.push(provinceObj);
});

// Sort provinces by code
this.data.sort((a, b) => a.Id.localeCompare(b.Id));
```

### 3. Backward Compatibility

Code conversion đảm bảo **100% backward compatible**:
- ✅ `this.data` vẫn là array format (giống cũ)
- ✅ `province.Id`, `province.Name`, `province.Districts` vẫn giống cũ
- ✅ `district.Id`, `district.Name`, `district.Wards` vẫn giống cũ
- ✅ `ward.Id`, `ward.Name` vẫn giống cũ
- ✅ Tất cả code khác (orders-smart-paste.js, etc.) không cần sửa

### 4. Lợi ích

#### Dữ liệu mới hơn ✅
- **Bình Dương**: "Thành phố Tân Uyên" (đã lên thành phố)
- **Bình Dương**: "Huyện Bắc Tân Uyên" (mới thành lập)
- **Bình Dương**: "Xã Tân Lập" trong "Huyện Bắc Tân Uyên"

#### Metadata phong phú hơn ✅
- `type`: "thanh-pho", "quan", "huyen", "thi-xa", "phuong", "xa", "thi-tran"
- `slug`: URL-friendly slug
- `path`: Full path without type
- `path_with_type`: Full path with type
- `parent_code`: Parent reference

#### Dễ maintain hơn ✅
- Cấu trúc nested rõ ràng hơn
- Code-based lookup (object keys)
- Dễ update từ nguồn chính thức

## Testing

### Test 1: Load data
```javascript
await window.addressSelector.init();
console.log('Provinces:', window.addressSelector.data.length);
console.log('Districts:', window.addressSelector.districtMap.size);
console.log('Wards:', window.addressSelector.wardMap.size);
```

Expected output:
```
Provinces: 63
Districts: 713
Wards: 10599
```

### Test 2: Bình Dương districts
```javascript
const bd = window.addressSelector.data.find(p => p.Name.includes('Bình Dương'));
console.log('Bình Dương districts:');
bd.Districts.forEach(d => console.log('  -', d.Name));
```

Expected output:
```
Bình Dương districts:
  - Thành phố Thủ Dầu Một
  - Huyện Bàu Bàng
  - Huyện Dầu Tiếng
  - Thị xã Bến Cát
  - Huyện Phú Giáo
  - Thành phố Tân Uyên ✅ (upgraded from Thị xã)
  - Thành phố Dĩ An
  - Thành phố Thuận An
  - Huyện Bắc Tân Uyên ✅ (new)
```

### Test 3: Xã Tân Lập
```javascript
const bd = window.addressSelector.data.find(p => p.Name.includes('Bình Dương'));
const btu = bd.Districts.find(d => d.Name.includes('Bắc Tân Uyên'));
console.log('Huyện Bắc Tân Uyên wards:');
btu.Wards.forEach(w => console.log('  -', w.Name));
```

Expected output:
```
Huyện Bắc Tân Uyên wards:
  - Xã Tân Định
  - Xã Bình Mỹ
  - Thị trấn Tân Bình
  - Xã Tân Lập ✅ (now available!)
  - Thị trấn Tân Thành
  - Xã Đất Cuốc
  - Xã Hiếu Liêm
  - Xã Lạc An
  - Xã Tân Mỹ
  - Xã Thường Tân
```

### Test 4: Address parsing
```javascript
// Test address that was failing before
const result = parseAddress("Khu phố 3 Tân lập Bắc Tân Uyên Bình Dương");
console.log('Province:', result.province?.Name);
console.log('District:', result.district?.Name);
console.log('Ward:', result.ward?.Name);
```

Expected output:
```
Province: Tỉnh Bình Dương ✅
District: Huyện Bắc Tân Uyên ✅
Ward: Xã Tân Lập ✅
```

## Rollback Plan

Nếu có vấn đề, có thể rollback bằng cách:

1. Revert `address-selector.js`:
```javascript
// Change back to vietnamAddress.json
const basePath = window.location.pathname.includes('/admin/') 
    ? '../assets/data/vietnamAddress.json' 
    : '/assets/data/vietnamAddress.json';

const response = await fetch(basePath);
this.data = await response.json();

// Use old indexing logic
this.data.forEach(province => {
    this.provinceMap.set(province.Id, province);
    // ...
});
```

2. File `vietnamAddress.json` vẫn còn trong repo (chưa xóa)

## Next Steps

1. ✅ Update `address-selector.js` to use `tree.json`
2. ✅ Test thoroughly
3. 🔄 Monitor for issues
4. 🔄 After 1 week of stable operation, can delete `vietnamAddress.json`
5. 🔄 Update documentation

## Files Changed

- ✅ `public/assets/js/address-selector.js` - Load tree.json instead of vietnamAddress.json
- ✅ `MIGRATION-TREE-JSON.md` - This documentation

## Files to Keep (for now)

- ⚠️ `public/assets/data/vietnamAddress.json` - Keep as backup for 1 week
- ℹ️ `scripts/convert-tree-to-address.js` - Keep for reference

## Files to Delete (after 1 week)

- 🗑️ `public/assets/data/vietnamAddress.json` - Old data
- 🗑️ `scripts/convert-tree-to-address.js` - No longer needed

---

**Author**: AI Assistant (Kiro)  
**Date**: 2026-01-21  
**Status**: ✅ Migrated to tree.json
