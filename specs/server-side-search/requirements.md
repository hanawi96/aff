# Requirements: Server-Side Search API - Tìm kiếm Toàn bộ Đơn hàng

## Overview

Hiện tại, chức năng tìm kiếm trên trang admin chỉ hoạt động trong phạm vi 1000 đơn hàng gần nhất được load về client. Người dùng không thể tìm kiếm các đơn hàng cũ hơn. Tính năng này sẽ bổ sung khả năng tìm kiếm toàn bộ đơn hàng trong database thông qua Server-Side Search API, đảm bảo hiệu năng cao và trải nghiệm mượt mà.

## Business Goals

- Cho phép tìm kiếm **TẤT CẢ đơn hàng** trong database, không giới hạn 1000 đơn gần nhất
- Duy trì hiệu năng cao: kết quả trả về dưới 500ms
- Không làm thay đổi trải nghiệm hiện tại (backward compatible)
- Giảm tải client: không parse 1000 đơn trên browser

## Target Users

- **Admin CTV**: Nhân viên quản lý đơn hàng cần tìm đơn cũ
- **CTV**: Cộng tác viên cần tra cứu đơn hàng của khách hàng
- **Support team**: Team hỗ trợ cần tìm lịch sử đơn hàng

## User Stories

### US1: Tìm kiếm đơn hàng cũ
**As a** Admin CTV  
**I want to** tìm kiếm đơn hàng từ nhiều tháng trước  
**So that** tôi có thể tra cứu lịch sử đơn hàng của khách hàng

**Acceptance Criteria:**
- Có thể tìm thấy đơn hàng từ 6 tháng trước trở lại
- Kết quả trả về trong vòng 500ms
- Hiển thị tối đa 100 kết quả phù hợp nhất

### US2: Tìm kiếm theo nhiều tiêu chí
**As a** Admin CTV  
**I want to** tìm kiếm theo mã đơn, tên khách, số điện thoại, địa chỉ, ghi chú  
**So that** tôi có thể tìm đơn hàng một cách linh hoạt

**Acceptance Criteria:**
- Tìm được theo: order_id, customer_name, customer_phone, address, notes
- Tìm kiếm không phân biệt hoa thường
- Hỗ trợ tìm kiếm partial match (tìm "Nguyễn" ra "Nguyễn Văn A")

### US3: Chỉ báo rõ ràng về phạm vi tìm kiếm
**As a** Admin CTV  
**I want to** biết rõ tôi đang tìm trong toàn bộ database hay chỉ 1000 đơn gần nhất  
**So that** tôi không bị nhầm lẫn khi không tìm thấy kết quả

**Acceptance Criteria:**
- UI hiển thị rõ "Tìm trong 1000 đơn" vs "Tìm toàn bộ"
- Có toggle hoặc button để chuyển đổi giữa 2 chế độ
- Badge hiển thị số kết quả tìm thấy

### US4: Trải nghiệm tìm kiếm mượt mà
**As a** Admin CTV  
**I want to** thấy kết quả tìm kiếm ngay lập tức không lag  
**So that** công việc không bị gián đoạn

**Acceptance Criteria:**
- Debounce 300ms trước khi gọi API
- Hiển thị loading indicator khi đang search
- Không block UI trong khi chờ kết quả
- Cache kết quả tìm kiếm trong 1 phút

## Functional Requirements

### FR1: Backend API Endpoint
- **Endpoint:** `GET /?action=searchOrders`
- **Query Parameters:**
  - `q` (required): Search term (string, min 2 chars)
  - `limit` (optional): Number of results (default: 100, max: 500)
  - `offset` (optional): Pagination offset (default: 0)
- **Response:**
  ```json
  {
    "success": true,
    "orders": [...],
    "total": 1234,
    "hasMore": true,
    "searchTerm": "DH179"
  }
  ```

### FR2: Search Fields
Tìm kiếm trong các field sau (case-insensitive, LIKE %term%):
1. `order_id` - Mã đơn hàng (priority: highest)
2. `customer_phone` - Số điện thoại (priority: high)
3. `customer_name` - Tên khách hàng (priority: high)
4. `address` - Địa chỉ giao hàng (priority: medium)
5. `notes` - Ghi chú đơn hàng (priority: low)

### FR3: Search Ranking
Kết quả sắp xếp theo:
1. **Exact match order_id** (ưu tiên cao nhất)
2. **Exact match phone** (ưu tiên cao)
3. **Partial match order_id**
4. **Partial match phone/name**
5. **Match address/notes**
6. **created_at_unix DESC** (trong cùng priority)

### FR4: Frontend Integration
- Toggle button: "Tìm nhanh (1000 đơn)" ⇄ "Tìm toàn bộ (Server)"
- Default: "Tìm nhanh" (giữ nguyên behavior hiện tại)
- Khi switch sang "Tìm toàn bộ": gọi API searchOrders
- Debounce 300ms cho server search
- Loading indicator: skeleton UI hoặc spinner

### FR5: Performance Requirements
- API response time: < 500ms (p95)
- Frontend debounce: 300ms
- Cache server search results: 60 seconds (client-side)
- Pagination: 100 items per page

### FR6: Error Handling
- Query quá ngắn (< 2 chars): Hiển thị hint "Nhập ít nhất 2 ký tự"
- API timeout: Hiển thị "Tìm kiếm quá lâu, vui lòng thử lại"
- No results: Hiển thị "Không tìm thấy đơn hàng phù hợp"
- Network error: Fallback về search local (1000 đơn)

## Non-Functional Requirements

### NFR1: Performance
- Database query execution: < 300ms
- Database indexes: MUST have index on search fields
- Query optimization: Use SQLite LIKE with leading wildcard efficiently
- No N+1 queries: JOIN with ctv table in single query

### NFR2: Scalability
- API rate limiting: 30 requests/minute per IP (optional for phase 1)
- Maximum result set: 500 orders (configurable)
- Pagination support for large result sets

### NFR3: Security
- SQL injection prevention: Use parameterized queries
- Input validation: Escape special characters
- XSS prevention: Sanitize output on frontend

### NFR4: Maintainability
- Code reuse: Leverage existing getRecentOrders query structure
- Logging: Log slow queries (> 500ms) for monitoring
- Error tracking: Integrate with existing error handling

### NFR5: Compatibility
- Backward compatible: Không phá vỡ chức năng tìm kiếm hiện tại
- Mobile responsive: UI toggle hoạt động tốt trên mobile
- Browser support: Chrome, Firefox, Safari, Edge (latest 2 versions)

## Technical Constraints

- **Backend:** Cloudflare Workers + D1 (SQLite)
- **Frontend:** Vanilla JavaScript (no framework)
- **Database:** D1 có giới hạn 1MB per row, 5s max query time
- **API:** Cloudflare Workers free tier: 100,000 requests/day

## Success Metrics

- **Primary:** 100% đơn hàng trong database có thể tìm kiếm được
- **Performance:** 95% queries trả về < 500ms
- **Usage:** 30% users sử dụng "Tìm toàn bộ" trong tuần đầu
- **Error rate:** < 1% API errors

## Out of Scope (for this phase)

- Full-Text Search (FTS5) - sẽ làm ở phase 2 nếu LIKE không đủ nhanh
- Advanced filters (date range, status, amount range)
- Fuzzy search (gõ sai chính tả)
- Search suggestions/autocomplete
- Export search results

## Dependencies

- Existing code:
  - `src/services/orders/order-queries.js` (getRecentOrders)
  - `src/handlers/get-handler.js` (API routing)
  - `public/assets/js/orders/orders-filters.js` (frontend search)
  - `public/assets/js/orders/orders-data-loader.js` (data loading)

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Database LIKE query quá chậm | High | Medium | Thêm indexes, limit kết quả, consider FTS5 nếu cần |
| D1 rate limiting | Medium | Low | Implement client-side cache, debounce |
| Users nhầm lẫn 2 chế độ search | Medium | Medium | UI/UX rõ ràng, onboarding tooltip |
| Tăng chi phí Workers | Low | Low | Monitor usage, optimize queries |

## Questions for Clarification

1. Có cần tìm kiếm trong `products` (tên sản phẩm) không? (hiện tại products là JSON)
2. Có cần phân quyền tìm kiếm không? (VD: CTV chỉ tìm đơn của mình)
3. Có cần lưu search history không?
4. Performance threshold chấp nhận được là bao nhiêu? (đang đặt 500ms)

## Assumptions

- Database có < 1 triệu đơn hàng (SQLite LIKE vẫn chạy ổn)
- Users search term thường là: mã đơn, số điện thoại, tên khách
- Phần lớn search chỉ cần 50-100 kết quả đầu
- Network latency user → Cloudflare < 100ms (Việt Nam)
