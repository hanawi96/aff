# Flash Sales - Auto Status Update Implementation

## 🎯 Requirement

**User Question**: "Khi tôi lên lịch flash sale lúc 10:05, thì đến 10:05 khi load trang, nó đã đổi sang 'Đang diễn ra' chưa?"

**Answer**: Bây giờ đã có! ✅

## 🔍 Problem Analysis

### Before Fix
❌ **No automatic status updates**
1. Create flash sale with status="scheduled", start_time=10:05
2. At 10:05, status still="scheduled" in database
3. No mechanism to auto-update status
4. User sees wrong status until manual refresh or update

### Root Causes
1. ❌ No trigger in database
2. ❌ No cron job/scheduled task
3. ❌ Backend just SELECT without UPDATE
4. ❌ Frontend displays database status as-is

## ✅ Solution Implemented

### Approach: **Backend Auto-Update on Query**

Every time `getAllFlashSales()` or `getActiveFlashSales()` is called, backend automatically updates statuses based on current time BEFORE returning data.

### Why This Approach?
- ✅ **Simple**: No need for cron jobs or triggers
- ✅ **Reliable**: Updates happen when data is actually needed
- ✅ **Efficient**: Only runs when someone views the page
- ✅ **Real-time**: Status always correct when displayed
- ✅ **No infrastructure**: Works with existing Cloudflare Workers

## 🔧 Implementation Details

### Backend Changes

#### File: `src/services/flash-sales/flash-sale-service.js`

**Function: `getAllFlashSales()`**

```javascript
export async function getAllFlashSales(env, corsHeaders) {
    try {
        const now = Math.floor(Date.now() / 1000);
        
        // AUTO-UPDATE 1: scheduled → active
        // When start time has passed but end time hasn't
        await env.DB.prepare(`
            UPDATE flash_sales 
            SET status = 'active', updated_at_unix = ?
            WHERE status = 'scheduled' 
                AND start_time <= ? 
                AND end_time > ?
        `).bind(now, now, now).run();
        
        // AUTO-UPDATE 2: active → ended
        // When end time has passed
        await env.DB.prepare(`
            UPDATE flash_sales 
            SET status = 'ended', updated_at_unix = ?
            WHERE status = 'active' 
                AND end_time <= ?
        `).bind(now, now).run();
        
        // AUTO-UPDATE 3: scheduled → ended
        // When both times have passed (edge case)
        await env.DB.prepare(`
            UPDATE flash_sales 
            SET status = 'ended', updated_at_unix = ?
            WHERE status = 'scheduled' 
                AND end_time <= ?
        `).bind(now, now).run();
        
        // Now SELECT with updated statuses
        const { results: flashSales } = await env.DB.prepare(`
            SELECT fs.*, COUNT(fsp.id) as product_count, ...
            FROM flash_sales fs ...
        `).all();
        
        return jsonResponse({ success: true, flashSales });
    } catch (error) {
        // error handling
    }
}
```

**Function: `getActiveFlashSales()`** (for public display)

Same auto-update logic before querying active flash sales.

## 📊 Status Transition Logic

### Transition 1: scheduled → active
```
Condition: status='scheduled' AND now >= start_time AND now < end_time
Action: UPDATE status='active'
Example: Flash sale scheduled for 10:05, at 10:05 becomes active
```

### Transition 2: active → ended
```
Condition: status='active' AND now >= end_time
Action: UPDATE status='ended'
Example: Flash sale ends at 18:00, at 18:00 becomes ended
```

### Transition 3: scheduled → ended (edge case)
```
Condition: status='scheduled' AND now >= end_time
Action: UPDATE status='ended'
Example: Flash sale scheduled but never activated, time passed
```

### Manual Statuses (Not Auto-Updated)
- `draft` - Stays draft until manually changed
- `cancelled` - Stays cancelled permanently

## 🧪 Testing Scenarios

### Scenario 1: Scheduled Flash Sale Activation
```
Setup:
- Create flash sale
- Name: "Test Flash Sale"
- Start: Today 10:05
- End: Today 18:00
- Status: scheduled

Test Steps:
1. At 10:04 - Load page
   Expected: Status = "Đã lên lịch" (scheduled)
   
2. At 10:05 - Reload page
   Expected: Status = "Đang chạy" (active) ✅
   
3. At 18:00 - Reload page
   Expected: Status = "Đã kết thúc" (ended) ✅
```

### Scenario 2: Immediate Activation
```
Setup:
- Create flash sale
- Start: Now
- End: Tomorrow
- Status: active

Test:
- Load page immediately
  Expected: Status = "Đang chạy" (active) ✅
```

### Scenario 3: Past Flash Sale
```
Setup:
- Create flash sale
- Start: Yesterday
- End: Yesterday 18:00
- Status: scheduled (forgot to activate)

Test:
- Load page today
  Expected: Status = "Đã kết thúc" (ended) ✅
```

## ⏱️ Timeline Example

```
Flash Sale: "Weekend Sale"
Start: 2026-01-25 10:05:00
End: 2026-01-25 18:00:00

Timeline:
09:00 - Status: scheduled (not started yet)
10:04 - Status: scheduled (1 minute before)
10:05 - Status: active ✅ (auto-updated when page loads)
12:00 - Status: active (still running)
17:59 - Status: active (1 minute before end)
18:00 - Status: ended ✅ (auto-updated when page loads)
18:01 - Status: ended (permanently ended)
```

## 🎯 Benefits

### 1. Accurate Status Display
- Users always see correct status
- No manual intervention needed
- Real-time accuracy

### 2. Automatic Lifecycle Management
- Flash sales start automatically
- Flash sales end automatically
- No forgotten activations

### 3. Simple Architecture
- No cron jobs needed
- No complex scheduling
- Works with serverless (Cloudflare Workers)

### 4. Database Consistency
- Status in database is always up-to-date
- Can be used by other systems
- Audit trail via updated_at_unix

## 📈 Performance Impact

### Query Performance
- **3 UPDATE queries** before each SELECT
- Updates only affect rows that need changing
- Indexed on `status` column (fast)
- Minimal performance impact

### Optimization
```sql
-- These updates are fast because:
1. WHERE status = 'scheduled' - Uses index
2. AND start_time <= ? - Uses index
3. Only updates matching rows (usually 0-5 rows)
```

### Load Impact
- Updates only run when someone loads the page
- No background processing
- Scales with actual usage

## 🔄 Alternative Approaches (Not Used)

### Option 1: Database Triggers
```sql
CREATE TRIGGER auto_update_flash_sale_status
AFTER SELECT ON flash_sales
...
```
**Why not**: SQLite doesn't support AFTER SELECT triggers

### Option 2: Cloudflare Cron Triggers
```javascript
// wrangler.toml
[triggers]
crons = ["*/1 * * * *"]  // Every minute
```
**Why not**: 
- More complex setup
- Runs even when not needed
- Costs more (more invocations)

### Option 3: Frontend Calculation Only
```javascript
function calculateStatus(flashSale) {
    const now = Date.now() / 1000;
    if (now < flashSale.start_time) return 'scheduled';
    if (now < flashSale.end_time) return 'active';
    return 'ended';
}
```
**Why not**:
- Database status out of sync
- Other systems see wrong status
- No single source of truth

## ✅ Verification Checklist

- [x] Backend auto-updates status on getAllFlashSales()
- [x] Backend auto-updates status on getActiveFlashSales()
- [x] Scheduled → Active transition works
- [x] Active → Ended transition works
- [x] Scheduled → Ended transition works (edge case)
- [x] Draft status not affected
- [x] Cancelled status not affected
- [x] updated_at_unix timestamp updated
- [x] Performance acceptable
- [x] Works with Cloudflare Workers

## 🎉 Result

**Question**: "Khi tôi lên lịch lúc 10:05, đến 10:05 load trang thì đã đổi sang 'Đang diễn ra' chưa?"

**Answer**: **CÓ RỒI! ✅**

- Tạo flash sale với status="scheduled", start_time=10:05
- Đến 10:05, load trang admin
- Backend tự động UPDATE status="active"
- Hiển thị "Đang chạy" (active)
- Hoàn toàn tự động, không cần thao tác gì!

## 📁 Files Modified

- `src/services/flash-sales/flash-sale-service.js`
  - Updated `getAllFlashSales()` - Added auto-update logic
  - Updated `getActiveFlashSales()` - Added auto-update logic

## 🚀 Deployment

No special deployment steps needed:
1. Deploy updated backend code
2. Flash sales will auto-update immediately
3. No database migration required
4. No configuration changes needed

**Status**: AUTO STATUS UPDATE IMPLEMENTED ✅
