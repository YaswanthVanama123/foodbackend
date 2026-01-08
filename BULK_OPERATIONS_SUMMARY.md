# Order Bulk Operations - Implementation Summary

## Files Created

### 1. Controller
**File:** `/Users/yaswanthgandhi/Documents/patlinks/packages/backend/src/controllers/orderBulkController.ts`

Contains three main controller methods:
- `bulkUpdateOrderStatus` - Update status of multiple orders at once
- `bulkDeleteOrders` - Delete multiple orders with safety checks
- `exportOrders` - Export orders to CSV with filtering

### 2. Routes
**File:** `/Users/yaswanthgandhi/Documents/patlinks/packages/backend/src/routes/orderBulkRoutes.ts`

Defines routes:
- `PATCH /api/orders/bulk/update-status` - Bulk status update
- `DELETE /api/orders/bulk/delete` - Bulk delete orders
- `GET /api/orders/bulk/export` - Export to CSV

All routes require admin authentication.

### 3. Validators
**Updated:** `/Users/yaswanthgandhi/Documents/patlinks/packages/backend/src/utils/validators.ts`

Added three new validator groups:
- `bulkUpdateOrderStatusValidator` - Validates orderIds array and status
- `bulkDeleteOrdersValidator` - Validates orderIds array and confirm flag
- `exportOrdersValidator` - Validates query parameters for export

### 4. Server Integration
**Updated:** `/Users/yaswanthgandhi/Documents/patlinks/packages/backend/src/server.ts`

- Imported `orderBulkRoutes`
- Mounted at `/api/orders/bulk`
- Fully integrated with tenant middleware

## Key Features

### Security & Multi-Tenancy
- All operations are tenant-scoped (restaurantId validation)
- Admin authentication required for all endpoints
- Prevents cross-tenant data access
- Validates MongoDB ObjectIds before operations

### Bulk Update Order Status
- Updates multiple orders with single API call
- Validates status against allowed values
- Updates table occupancy when marking served/cancelled
- Emits socket events for each order (real-time updates)
- Returns both requested and actual updated counts
- Full status history tracking

### Bulk Delete Orders
- Requires explicit confirmation flag (confirm: true)
- Safety check: prevents deletion of active orders (preparing, ready)
- Lists active orders if deletion blocked
- Updates table occupancy
- Emits socket events for deletions
- Tenant-scoped deletion

### Export to CSV
- Flexible filtering: date range and status
- Comprehensive CSV format with 15 columns
- Includes customer information (guest-aware)
- Properly escapes CSV special characters
- Item details with customizations
- Downloadable file with appropriate headers
- Shows all financial information

### Real-Time Updates
- Integrates with Socket.io service
- Emits to both table rooms (customers) and admin room
- Namespace-based isolation per restaurant
- Events: `order-status-updated`, `order-status-changed`

## API Endpoints

### 1. Bulk Update Status
```
PATCH /api/orders/bulk/update-status
Body: { orderIds: string[], status: string }
Auth: Required (Admin)
```

### 2. Bulk Delete
```
DELETE /api/orders/bulk/delete
Body: { orderIds: string[], confirm: true }
Auth: Required (Admin)
```

### 3. Export CSV
```
GET /api/orders/bulk/export?startDate=2026-01-01&endDate=2026-01-31&status=served
Auth: Required (Admin)
```

## Validation Rules

### Order IDs
- Must be array with at least 1 element
- All IDs must be valid MongoDB ObjectIds
- Must belong to authenticated restaurant

### Status
- Must be one of: received, preparing, ready, served, cancelled

### Confirmation (Delete)
- Must be exactly `true` (boolean)
- Required to prevent accidental deletions

### Export Dates
- Must be ISO 8601 format
- Optional but validated if provided

## CSV Export Format

Headers:
```
Order Number, Date, Time, Table Number, Table Location, Customer Name,
Customer Email, Status, Items Count, Items Details, Subtotal, Tax,
Total, Notes, Served At
```

Features:
- Escapes quotes in text fields
- Handles missing customer data (shows "Guest")
- Formats dates and times appropriately
- Includes full item customizations
- Shows location information

## Error Handling

All endpoints return consistent error format:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (dev mode)"
}
```

HTTP Status Codes:
- 200: Success
- 400: Bad Request (validation errors)
- 401: Unauthorized
- 404: Not Found
- 500: Server Error

## Testing the API

### Example: Bulk Update Status
```bash
curl -X PATCH http://localhost:5000/api/orders/bulk/update-status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderIds": ["order_id_1", "order_id_2"],
    "status": "preparing"
  }'
```

### Example: Bulk Delete
```bash
curl -X DELETE http://localhost:5000/api/orders/bulk/delete \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderIds": ["order_id_1", "order_id_2"],
    "confirm": true
  }'
```

### Example: Export Orders
```bash
curl -X GET "http://localhost:5000/api/orders/bulk/export?startDate=2026-01-01&endDate=2026-01-31&status=served" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --output orders_export.csv
```

## Integration Points

### Database Models Used
- `Order` - Main order model
- `Table` - For updating occupancy status

### Services Used
- `getSocketService()` - Real-time event emission
- Socket events emitted:
  - `emitOrderStatusUpdate()` - To table room
  - `emitOrderStatusChange()` - To admin room

### Middleware Used
- `authMiddleware` - Admin authentication
- `extractTenant` - Multi-tenant context extraction
- `handleValidationErrors` - Express validator error handler

## Notes

1. **Performance**: Keep batch sizes reasonable (< 100 orders recommended)
2. **Socket Events**: Non-critical, failures don't affect operation success
3. **Table Occupancy**: Automatically updated when orders served/cancelled
4. **Status History**: Each status change is tracked with timestamp and admin
5. **CSV Size**: Use date ranges to control export file size
6. **Partial Success**: Returns count of actual updates vs requested

## Future Enhancements (Optional)

- Add progress tracking for large batches
- Support for paginated exports
- Additional export formats (Excel, JSON)
- Scheduled exports
- Bulk order assignment to kitchen stations
- Batch printing of orders
- Advanced filtering options

## Documentation

Full API documentation available at:
`/Users/yaswanthgandhi/Documents/patlinks/packages/backend/ORDER_BULK_API_DOCS.md`
