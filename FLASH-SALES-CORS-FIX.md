# Flash Sales CORS Error Fix

## Error Message
```
Access to fetch at 'https://ctv-api.yendev96.workers.dev/api?action=getAllFlashSales' 
from origin 'http://127.0.0.1:5500' has been blocked by CORS policy: 
The value of the 'Access-Control-Allow-Origin' header in the response must not be 
the wildcard '*' when the request's credentials mode is 'include'.
```

## Root Cause Analysis

### The Problem
**CORS Security Rule**: When using `credentials: 'include'` in a fetch request, the server CANNOT respond with `Access-Control-Allow-Origin: *` (wildcard). The server must specify the exact origin.

### Why It Happened
1. **Server Configuration** (`src/config/cors.js`):
   ```javascript
   export const corsHeaders = {
       'Access-Control-Allow-Origin': '*',  // ❌ Wildcard
       'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
       'Access-Control-Allow-Headers': 'Content-Type, Authorization',
   };
   ```

2. **Client Code** (`flash-sales.js`):
   ```javascript
   const response = await fetch(`${API_BASE}/api?action=getAllFlashSales`, {
       credentials: 'include'  // ❌ Requires specific origin, not wildcard
   });
   ```

3. **Conflict**: 
   - Client sends `credentials: 'include'`
   - Server responds with `Access-Control-Allow-Origin: *`
   - Browser blocks the request (security violation)

### Why Other Pages Work
All other admin pages (orders, products, discounts, etc.) do NOT use `credentials: 'include'`:

```javascript
// ✅ Working pattern (from orders-data-loader.js)
const response = await fetch(`${CONFIG.API_URL}?action=getRecentOrders&limit=1000`);
// No credentials option = works with wildcard CORS
```

## Solution Applied

### Option 1: Remove `credentials: 'include'` (CHOSEN ✅)
This is the simplest and most consistent solution with the rest of the codebase.

**Changed in `flash-sales.js`:**
```javascript
// BEFORE ❌
const response = await fetch(`${API_BASE}/api?action=getAllFlashSales`, {
    credentials: 'include'
});

// AFTER ✅
const response = await fetch(`${API_BASE}/api?action=getAllFlashSales`);
```

**Why This Works:**
- No credentials = browser doesn't send cookies/auth headers
- Server can respond with `Access-Control-Allow-Origin: *`
- Matches the pattern used by all other pages
- Authentication is handled by session token in localStorage (not cookies)

### Option 2: Fix Server CORS (NOT CHOSEN)
Would require changing server to return specific origin instead of wildcard:

```javascript
// Would need to change src/config/cors.js
export const corsHeaders = {
    'Access-Control-Allow-Origin': request.headers.get('Origin'),  // Specific origin
    'Access-Control-Allow-Credentials': 'true',  // Required for credentials
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
```

**Why NOT chosen:**
- Would require backend changes
- Would affect all API endpoints
- Current system doesn't use cookie-based auth (uses localStorage tokens)
- Inconsistent with existing codebase pattern

## Files Modified
- `public/assets/js/flash-sales.js` - Removed `credentials: 'include'` from both fetch calls

## How Authentication Works
The system uses **localStorage-based authentication**, not cookie-based:

1. User logs in → receives session token
2. Token stored in `localStorage.getItem('session_token')`
3. `auth-check.js` verifies token on page load
4. API calls don't need `credentials: 'include'` because auth is in localStorage, not cookies

## Testing
1. Clear browser cache
2. Access: `http://127.0.0.1:5500/public/admin/flash-sales.html`
3. Expected: Page loads without CORS errors
4. Expected: API calls succeed and data displays

## Key Takeaway
**Never use `credentials: 'include'` with wildcard CORS (`Access-Control-Allow-Origin: *`).**

Either:
- Remove `credentials: 'include'` (if not using cookies) ✅
- OR change server to return specific origin (if using cookies)

In this project, we use localStorage tokens, so `credentials: 'include'` is unnecessary.
