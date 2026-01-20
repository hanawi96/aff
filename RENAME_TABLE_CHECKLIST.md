# Checklist: Rename cost_config → materials

## ✅ Phase 1: Database Migration

- [ ] Run migration: `node database/run-migration-051.js`
- [ ] Verify table renamed successfully
- [ ] Verify triggers recreated
- [ ] Verify indexes created

## ✅ Phase 2: Backend Code Updates

### Services (src/services/)

- [ ] **src/services/settings/packaging.js** (2 places)
  - Line 7: `SELECT * FROM cost_config` → `SELECT * FROM materials`
  - Line 56: `INSERT INTO cost_config` → `INSERT INTO materials`

- [ ] **src/services/settings/tax.js** (2 places)
  - Line 9: `FROM cost_config` → `FROM materials`
  - Line 57: `INSERT INTO cost_config` → `INSERT INTO materials`

- [ ] **src/services/orders/order-service.js** (2 places)
  - Line 113: `FROM cost_config WHERE` → `FROM materials WHERE`
  - Line 159: `FROM cost_config WHERE` → `FROM materials WHERE`

- [ ] **src/services/materials/material-service.js** (7 places)
  - Line 11: `LEFT JOIN cost_config cc` → `LEFT JOIN materials cc`
  - Line 178: `FROM cost_config WHERE` → `FROM materials WHERE`
  - Line 188: `UPDATE cost_config` → `UPDATE materials`
  - Line 327: `FROM cost_config cc` → `FROM materials cc`
  - Line 362: `FROM cost_config WHERE` → `FROM materials WHERE`
  - Line 387: `INSERT INTO cost_config` → `INSERT INTO materials`
  - Line 443: `FROM cost_config WHERE` → `FROM materials WHERE`
  - Line 456: `FROM cost_config WHERE` → `FROM materials WHERE`
  - Line 470: `UPDATE cost_config` → `UPDATE materials`
  - Line 547: `DELETE FROM cost_config` → `DELETE FROM materials`
  - Line 580: `JOIN cost_config cc` → `JOIN materials cc`

## ✅ Phase 3: Frontend Code Updates

### JavaScript Files (public/assets/js/)

- [ ] **public/assets/js/orders.js** (comments only - 2 places)
  - Line 250: Comment `// Get customer shipping fee from cost_config`
  - Line 258: Comment `// Get shipping cost from cost_config`
  - ⚠️ These are just comments, update for clarity

## ✅ Phase 4: Database Scripts Updates

- [ ] **database/migrations/048_create_product_materials_system.sql**
  - Line 23: Comment `-- Step 3: Add sample materials to cost_config`
  - Line 24: `INSERT OR IGNORE INTO cost_config` → `INSERT OR IGNORE INTO materials`

- [ ] **scripts/migration-archive/fix-triggers.js**
  - Line 24: `name: 'update_cost_config_timestamp'` → `name: 'update_materials_timestamp'`
  - Line 25: `CREATE TRIGGER IF NOT EXISTS update_cost_config_timestamp` → `update_materials_timestamp`
  - Line 26: `AFTER UPDATE ON cost_config` → `AFTER UPDATE ON materials`
  - Line 28: `UPDATE cost_config SET` → `UPDATE materials SET`

## ✅ Phase 5: Documentation Updates

- [ ] **DATABASE.md**
  - Line 88: `- cost_config - Cost configuration` → `- materials - Materials and cost configuration`

- [ ] **REVIEW_FINDINGS.md**
  - Line 139: `### 1. Add Index on cost_config.item_name` → `materials.item_name`
  - Line 141: `**Current**: Triggers JOIN on cost_config.item_name` → `materials.item_name`
  - Line 147: `CREATE INDEX IF NOT EXISTS idx_cost_config_item_name` → `idx_materials_item_name`
  - Line 148: `ON cost_config(item_name)` → `ON materials(item_name)`
  - Line 165: `ALTER TABLE cost_config ADD COLUMN` → `ALTER TABLE materials ADD COLUMN`
  - Line 166: `UPDATE cost_config SET` → `UPDATE materials SET`

- [ ] **PRODUCT_MATERIALS_INTEGRATION.md**
  - Line 232: `JOIN cost_config cc` → `JOIN materials cc`

- [ ] **MATERIAL_CATEGORIES_COMPLETE.md**
  - Line 79: `#### **2. Thêm cột vào cost_config**` → `materials`
  - Line 82: `ALTER TABLE cost_config` → `ALTER TABLE materials`
  - Line 99: `CREATE INDEX idx_cost_config_category` → `idx_materials_category`
  - Line 99: `ON cost_config(category_id)` → `ON materials(category_id)`
  - Line 217: `FROM cost_config cc` → `FROM materials cc`
  - Line 230: `LEFT JOIN cost_config cc` → `LEFT JOIN materials cc`
  - Line 243: `FROM cost_config cc` → `FROM materials cc`

- [ ] **MATERIALS_SYSTEM_COMPLETE.md**
  - Line 16: `- 16 nguyên liệu mặc định trong cost_config` → `materials`
  - Line 122: `│  cost_config    │` → `│  materials      │`

- [ ] **EDITABLE_ITEM_NAME_COMPLETE.md**
  - Line 57: `- Cập nhật cost_config với item_name mới` → `materials`
  - Line 68: `SELECT id FROM cost_config` → `FROM materials`
  - Line 85: `UPDATE cost_config` → `UPDATE materials`
  - Line 137: `- Cập nhật cost_config.item_name` → `materials.item_name`

- [ ] **DISPLAY_NAME_COMPLETE.md**
  - Line 11: `Added display_name column to cost_config table` → `materials table`
  - Line 20: `- Added display_name TEXT column to cost_config table` → `materials table`

## ✅ Phase 6: Testing

- [ ] Test materials page (CRUD operations)
- [ ] Test settings page (packaging config, shipping fees)
- [ ] Test orders page (create order with materials)
- [ ] Test product materials (add/edit/delete materials)
- [ ] Test tax rate updates
- [ ] Test profit reports
- [ ] Check all triggers working correctly

## ✅ Phase 7: Cleanup

- [ ] Delete old migration scripts if needed
- [ ] Update any remaining comments
- [ ] Commit changes with clear message

---

## Quick Commands

```bash
# 1. Run migration
node database/run-migration-051.js

# 2. Search for remaining references
grep -r "cost_config" src/
grep -r "cost_config" public/
grep -r "cost_config" database/

# 3. Test the application
npm run dev
```

## Notes

- ⚠️ **BACKUP DATABASE FIRST** before running migration
- The migration uses `ALTER TABLE RENAME` which is atomic
- All triggers will be recreated automatically
- Indexes will be created for better performance
- No data loss - only table name changes
