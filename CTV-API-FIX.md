# CTV API Fix - Resolved 404 Error

## Problem
When accessing CTV links (e.g., `?ref=CTV009726`), the API calls were returning 404 errors:
```
GET http://127.0.0.1:5500/api/ctv/validateReferral?ref=CTV009726 404 (Not Found)
```

## Root Causes

### 1. Port Mismatch
- Live Server runs on port 5500
- API server runs on port 8787
- Solution: Added `API_BASE_URL` constant that detects port and uses correct base URL

### 2. Wrong API Path Format
- **Incorrect**: `/api/ctv/validateReferral?ref=CTV009726`
- **Correct**: `/?action=validateReferral&ref=CTV009726`

The backend uses query parameter `action` for routing, not REST-style paths.

## Changes Made

### File: `public/shop/assets/js/shared/utils/ctv-tracking.js`

**Before:**
```javascript
const apiUrl = `${API_BASE_URL}/api/ctv/validateReferral?ref=${encodeURIComponent(refParam)}`;
```

**After:**
```javascript
const apiUrl = `${API_BASE_URL}/?action=validateReferral&ref=${encodeURIComponent(refParam)}`;
```

Applied to both:
1. `checkAndSaveReferralFromURL()` - validates referral when URL has ?ref=
2. `getCTVInfoForOrder()` - gets CTV info when placing order

## How to Test

1. **Start API server** (if not running):
   ```bash
   npm run dev
   ```
   Should run on http://localhost:8787

2. **Start Live Server** on port 5500 for the shop

3. **Access CTV link**:
   ```
   http://127.0.0.1:5500/public/shop/index.html?ref=CTV009726
   ```

4. **Check CTV Debug Panel**:
   - Purple "CTV" button should appear at bottom-right
   - Click to open panel
   - Should show:
     - ✅ Cookie status with CTV code
     - CTV name, phone, referral code
     - Commission rate (e.g., 10%)
     - Test commission calculation

5. **Check Console Logs**:
   ```
   ✅ [CTV Tracking] CTV validated and saved: {name: "...", code: "CTV009726", rate: 0.1}
   ✅ [CTV Panel] CTV Info found: {...}
   ```

## Expected Behavior

### When accessing `?ref=CTV009726`:
1. API validates referral code
2. Cookie `vdt_ctv_ref` is saved (7 days)
3. Debug panel shows CTV info
4. All future orders include CTV tracking

### When placing order:
1. System reads cookie
2. Validates CTV still active
3. Calculates commission: `(total - shipping) × rate`
4. Saves to order: `referral_code`, `commission`, `commission_rate`, `ctv_phone`

## API Endpoint Details

**Endpoint**: `GET /?action=validateReferral&ref={code}`

**Response**:
```json
{
  "success": true,
  "ctv": {
    "referralCode": "CTV009726",
    "name": "Nguyễn Văn A",
    "phone": "0987654321",
    "commissionRate": 0.1
  }
}
```

## Files Modified
- ✅ `public/shop/assets/js/shared/utils/ctv-tracking.js` - Fixed API URLs
- ✅ Already had `API_BASE_URL` constant for port handling
- ✅ Already had extensive console.log for debugging

## Status
🟢 **READY TO TEST** - All API calls now use correct format and port
