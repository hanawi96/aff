# Tasks: Server-Side Search Implementation

## Task Checklist

### Phase 1: Database Preparation

- [ ] **Task 1.1: Create Database Indexes**
  - File: Create new migration file
  - Create indexes for search optimization
  - Test index creation on local D1
  - Estimated time: 30 minutes

- [ ] **Task 1.2: Test Query Performance**
  - Run EXPLAIN QUERY PLAN on search queries
  - Benchmark with sample data (1k, 10k, 50k orders)
  - Document performance results
  - Estimated time: 45 minutes

### Phase 2: Backend Implementation

- [ ] **Task 2.1: Implement searchOrders Function**
  - File: `src/services/orders/order-queries.js`
  - Add searchOrders function with validation
  - Implement SQL query with LIKE conditions
  - Add error handling and logging
  - Estimated time: 1 hour

- [ ] **Task 2.2: Add API Route Handler**
  - File: `src/handlers/get-handler.js`
  - Add case 'searchOrders' routing
  - Parse query parameters
  - Call searchOrders function
  - Estimated time: 15 minutes

- [ ] **Task 2.3: Test Backend API**
  - Test with curl/Postman
  - Test edge cases (empty query, special chars, SQL injection)
  - Test pagination (limit, offset)
  - Verify response structure
  - Estimated time: 30 minutes

### Phase 3: Frontend Implementation

- [ ] **Task 3.1: Create Search Module**
  - File: `public/assets/js/orders/orders-search.js`
  - Implement initSearchModeToggle()
  - Implement performServerSearch() with debounce
  - Implement cache mechanism
  - Add loading/error states
  - Estimated time: 1.5 hours

- [ ] **Task 3.2: Create Toggle UI Component**
  - Add toggle switch HTML/CSS
  - Add mode indicator label
  - Add result info badge
  - Style with Tailwind CSS
  - Estimated time: 30 minutes

- [ ] **Task 3.3: Integrate with Existing Filter**
  - File: `public/assets/js/orders/orders-filters.js`
  - Add mode check in filterOrdersData()
  - Preserve existing local search behavior
  - Test compatibility
  - Estimated time: 20 minutes

- [ ] **Task 3.4: Update HTML Page**
  - File: `public/admin/index.html`
  - Add script tag for orders-search.js
  - Add event listener for search input
  - Initialize toggle on page load
  - Estimated time: 15 minutes

### Phase 4: Testing

- [ ] **Task 4.1: Unit Tests**
  - Test searchOrders with various inputs
  - Test validation logic
  - Test debounce timing
  - Test cache behavior
  - Estimated time: 1 hour

- [ ] **Task 4.2: Integration Tests**
  - Test end-to-end search flow
  - Test toggle functionality
  - Test error handling and fallback
  - Test on mobile and desktop
  - Estimated time: 1 hour

- [ ] **Task 4.3: Performance Tests**
  - Test with real database data
  - Measure API response time
  - Test cache hit rate
  - Identify bottlenecks
  - Estimated time: 45 minutes

### Phase 5: Deployment

- [ ] **Task 5.1: Deploy Database Migration**
  - Run migration on production D1
  - Verify indexes created successfully
  - Estimated time: 15 minutes

- [ ] **Task 5.2: Deploy Backend**
  - Deploy Workers code to Cloudflare
  - Test API endpoint in production
  - Monitor logs for errors
  - Estimated time: 20 minutes

- [ ] **Task 5.3: Deploy Frontend**
  - Deploy updated JS files
  - Clear CDN cache if applicable
  - Test in production environment
  - Estimated time: 15 minutes

- [ ] **Task 5.4: Monitoring Setup**
  - Set up logging for searchOrders
  - Track API usage metrics
  - Set up alerts for errors
  - Estimated time: 30 minutes

### Phase 6: Documentation

- [ ] **Task 6.1: Update API Documentation**
  - Document searchOrders endpoint
  - Add request/response examples
  - Add error codes reference
  - Estimated time: 30 minutes

- [ ] **Task 6.2: Create User Guide**
  - Write guide for using toggle
  - Add screenshots
  - Create FAQ section
  - Estimated time: 30 minutes

### Phase 7: Post-Launch

- [ ] **Task 7.1: Monitor Performance**
  - Monitor query times for first 24 hours
  - Check error rate
  - Review user feedback
  - Estimated time: Ongoing

- [ ] **Task 7.2: Optimize Based on Data**
  - Identify slow queries
  - Adjust cache TTL if needed
  - Fine-tune debounce timing
  - Estimated time: 1 hour

---

## Total Estimated Time: ~12-14 hours

## Priority Order

### Critical Path (Must complete in order):
1. Task 1.1 → Task 1.2 (Database prep)
2. Task 2.1 → Task 2.2 → Task 2.3 (Backend)
3. Task 3.1 → Task 3.2 → Task 3.3 → Task 3.4 (Frontend)
4. Task 4.1 → Task 4.2 → Task 4.3 (Testing)
5. Task 5.1 → Task 5.2 → Task 5.3 (Deployment)

### Can be done in parallel:
- Task 6.1 and 6.2 (Documentation) - while testing
- Task 1.2 (Performance testing) - can start while Task 2.1 is in progress

## Risk Items

⚠️ **High Risk:**
- Task 1.1: Database migration on production (có thể affect downtime)
- Task 2.1: Query performance might not meet 500ms target

⚠️ **Medium Risk:**
- Task 3.3: Integration với code cũ có thể break existing features
- Task 5.2: Deploy backend có thể conflict với traffic hiện tại

⚠️ **Low Risk:**
- Task 3.2: UI có thể cần điều chỉnh styling
- Task 4.3: Performance tests có thể cần nhiều thời gian hơn dự tính

## Dependencies

```
Task 1.1 (Indexes)
    ↓
Task 1.2 (Performance Test)
    ↓
Task 2.1 (searchOrders Function)
    ↓
Task 2.2 (API Route)
    ↓
Task 2.3 (Backend Tests)
    ↓
Task 3.1 (Search Module) ←┐
    ↓                       │
Task 3.2 (Toggle UI)        │
    ↓                       │
Task 3.3 (Integration) ─────┘
    ↓
Task 3.4 (Update HTML)
    ↓
Task 4.1, 4.2, 4.3 (Testing - parallel)
    ↓
Task 5.1 → 5.2 → 5.3 (Deployment - sequence)
    ↓
Task 5.4 (Monitoring)
    ↓
Task 7.1 → 7.2 (Post-launch)

Task 6.1, 6.2 (Documentation - can start anytime after Task 2.3)
```

## Acceptance Criteria (Overall)

### Functional
- ✅ Toggle hoạt động trơn tru, label cập nhật đúng
- ✅ Server search tìm được tất cả đơn hàng trong database
- ✅ Kết quả hiển thị giống như local search (format, styling)
- ✅ Debounce 300ms hoạt động, không gọi API mỗi keystroke
- ✅ Cache hoạt động, request giống nhau không gọi lại API
- ✅ Error fallback về local search hoạt động
- ✅ Loading indicator hiển thị khi đang search

### Performance
- ✅ API response time < 500ms (95% requests)
- ✅ Frontend debounce 300ms chính xác
- ✅ Cache hit rate > 20% sau 1 tuần
- ✅ No UI blocking during search

### Compatibility
- ✅ Local search (1000 đơn) vẫn hoạt động như cũ
- ✅ Hoạt động trên Chrome, Firefox, Safari, Edge
- ✅ Responsive trên mobile và desktop
- ✅ Không break existing features (filters, sorting, export)

### Security
- ✅ SQL injection tests pass
- ✅ XSS tests pass
- ✅ Input validation works correctly
- ✅ No sensitive data in error messages

## Notes for Implementation

### Backend Notes
- Sử dụng lại query structure từ `getRecentOrders` để đảm bảo consistency
- Log slow queries (> 500ms) để monitor
- Return same fields như `getRecentOrders` để frontend compatible
- Consider adding query timeout (5s D1 limit)

### Frontend Notes
- Preserve existing search behavior as default
- Make toggle discoverable but not intrusive
- Use consistent styling with existing UI
- Handle edge cases gracefully (network errors, slow API)

### Testing Notes
- Test with realistic data volume
- Test edge cases: empty results, special characters, very long search terms
- Test on slow networks (throttle in DevTools)
- Test concurrent searches (rapid typing)

### Deployment Notes
- Deploy backend first, test thoroughly before frontend
- Use feature flag if possible (toggle hidden until backend stable)
- Have rollback plan ready
- Monitor error logs closely for first 24 hours

## Post-Launch Checklist

- [ ] Monitor API request count and error rate
- [ ] Check query performance metrics (p50, p95, p99)
- [ ] Review user feedback and support tickets
- [ ] Identify most common search terms
- [ ] Analyze cache hit rate
- [ ] Check for any slow queries or timeouts
- [ ] Document lessons learned
- [ ] Plan Phase 2 enhancements based on data
