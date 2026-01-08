# Order Bulk Operations API Documentation

## Overview
The Order Bulk Operations API provides endpoints for administrators to perform bulk actions on multiple orders simultaneously. All endpoints require admin authentication and are tenant-scoped.

**Base URL:** `/api/orders/bulk`

---

## Endpoints

### 1. Bulk Update Order Status

Update the status of multiple orders at once.

**Endpoint:** `PATCH /api/orders/bulk/update-status`

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "orderIds": ["order_id_1", "order_id_2", "order_id_3"],
  "status": "preparing"
}
```

**Parameters:**
- `orderIds` (array, required): Array of MongoDB ObjectIds for orders to update
- `status` (string, required): New status for the orders. Must be one of:
  - `received`
  - `preparing`
  - `ready`
  - `served`
  - `cancelled`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully updated 3 order(s) to status: preparing",
  "data": {
    "updated": 3,
    "requested": 3,
    "status": "preparing",
    "orders": [
      {
        "_id": "order_id_1",
        "orderNumber": "ORD-20260108-001",
        "tableNumber": "5",
        "status": "preparing",
        "items": [...],
        "total": 45.50,
        "createdAt": "2026-01-08T10:30:00.000Z",
        "updatedAt": "2026-01-08T10:35:00.000Z"
      }
    ]
  }
}
```

**Error Responses:**

- **400 Bad Request** - Invalid input
```json
{
  "success": false,
  "message": "Order IDs array is required and must not be empty"
}
```

- **404 Not Found** - No orders found
```json
{
  "success": false,
  "message": "No orders found for the provided IDs"
}
```

**Features:**
- Validates all order IDs
- Only updates orders belonging to the authenticated restaurant (tenant-scoped)
- Updates table occupancy when orders are marked as served/cancelled
- Emits real-time socket events for each updated order
- Returns both requested count and actual updated count

---

### 2. Bulk Delete Orders

Delete multiple orders with safety checks.

**Endpoint:** `DELETE /api/orders/bulk/delete`

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "orderIds": ["order_id_1", "order_id_2", "order_id_3"],
  "confirm": true
}
```

**Parameters:**
- `orderIds` (array, required): Array of MongoDB ObjectIds for orders to delete
- `confirm` (boolean, required): Must be `true` to proceed with deletion (safety flag)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully deleted 3 order(s)",
  "data": {
    "deleted": 3,
    "requested": 3,
    "orderNumbers": ["ORD-20260108-001", "ORD-20260108-002", "ORD-20260108-003"]
  }
}
```

**Error Responses:**

- **400 Bad Request** - Missing confirmation
```json
{
  "success": false,
  "message": "Confirmation required. Set confirm: true to proceed with deletion"
}
```

- **400 Bad Request** - Active orders cannot be deleted
```json
{
  "success": false,
  "message": "Cannot delete active orders. 2 order(s) have status 'preparing' or 'ready'",
  "data": {
    "activeOrders": [
      {
        "_id": "order_id_1",
        "orderNumber": "ORD-20260108-001",
        "status": "preparing",
        "tableNumber": "5"
      }
    ]
  }
}
```

**Safety Features:**
- Requires explicit confirmation flag
- Prevents deletion of active orders (status: `preparing` or `ready`)
- Only deletes orders belonging to the authenticated restaurant (tenant-scoped)
- Updates associated table occupancy
- Emits socket events to notify admins of deletions

---

### 3. Export Orders to CSV

Export orders to a downloadable CSV file with filtering options.

**Endpoint:** `GET /api/orders/bulk/export`

**Authentication:** Required (Admin)

**Query Parameters:**
- `startDate` (string, optional): ISO 8601 date string for start date (e.g., "2026-01-01")
- `endDate` (string, optional): ISO 8601 date string for end date (e.g., "2026-01-31")
- `status` (string, optional): Filter by order status. One of:
  - `received`
  - `preparing`
  - `ready`
  - `served`
  - `cancelled`

**Example Request:**
```
GET /api/orders/bulk/export?startDate=2026-01-01&endDate=2026-01-31&status=served
```

**Success Response (200):**
Returns a CSV file with the following headers:
- Order Number
- Date
- Time
- Table Number
- Table Location
- Customer Name
- Customer Email
- Status
- Items Count
- Items Details
- Subtotal
- Tax
- Total
- Notes
- Served At

**Response Headers:**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="orders_export_2026-01-08.csv"
Cache-Control: no-cache
Pragma: no-cache
```

**CSV Example:**
```csv
Order Number,Date,Time,Table Number,Table Location,Customer Name,Customer Email,Status,Items Count,Items Details,Subtotal,Tax,Total,Notes,Served At
ORD-20260108-001,1/8/2026,10:30:00 AM,5,Window,John Doe,john@example.com,served,3,"2x Burger (Extra Cheese:Yes) | 1x Fries",42.50,3.00,45.50,"Extra ketchup",1/8/2026 11:00:00 AM
```

**Error Responses:**

- **400 Bad Request** - Invalid date format
```json
{
  "success": false,
  "errors": [
    {
      "msg": "Start date must be a valid ISO 8601 date",
      "param": "startDate",
      "location": "query"
    }
  ]
}
```

- **404 Not Found** - No orders found
```json
{
  "success": false,
  "message": "No orders found for the specified criteria"
}
```

**Features:**
- Flexible date range filtering
- Status-based filtering
- Includes customer information (if available)
- Handles guest orders (shows "Guest" for customer name)
- Properly escapes CSV special characters
- Includes item customizations in details
- Shows all order financial information
- Tenant-scoped (only exports orders from authenticated restaurant)

---

## Authentication

All endpoints require admin authentication. Include the JWT token in the request header:

```
Authorization: Bearer <your_jwt_token>
```

---

## Multi-Tenant Isolation

All bulk operations are automatically scoped to the authenticated admin's restaurant. This ensures:
- Admins can only perform bulk operations on their own orders
- No cross-tenant data access
- Complete data isolation between restaurants

---

## Socket Events

Bulk operations emit real-time events to keep all connected clients updated:

**Events Emitted:**
1. `order-status-updated` - Sent to table room for customers
2. `order-status-changed` - Sent to admin room for all admins

**Namespaces:**
- Events are emitted to restaurant-specific namespaces: `/restaurant/{restaurantId}`

---

## Use Cases

### Use Case 1: Mark Multiple Orders as Ready
```javascript
// Update multiple orders when kitchen completes them
const response = await fetch('/api/orders/bulk/update-status', {
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    orderIds: ['65a1b2c3d4e5f6g7h8i9j0', '65a1b2c3d4e5f6g7h8i9j1'],
    status: 'ready'
  })
});
```

### Use Case 2: Clean Up Old Orders
```javascript
// Delete old cancelled orders (must not be active)
const response = await fetch('/api/orders/bulk/delete', {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    orderIds: ['65a1b2c3d4e5f6g7h8i9j0', '65a1b2c3d4e5f6g7h8i9j1'],
    confirm: true
  })
});
```

### Use Case 3: Generate Monthly Report
```javascript
// Download CSV of all served orders for January
window.location.href = '/api/orders/bulk/export?' +
  new URLSearchParams({
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    status: 'served'
  });
```

---

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message (in development mode)"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing or invalid token)
- `404` - Not Found (no orders match criteria)
- `500` - Server Error

---

## Rate Limiting

Bulk operations are subject to the standard API rate limit:
- 100 requests per 15 minutes per IP address
- Consider the load when performing bulk operations on large datasets

---

## Best Practices

1. **Batch Size**: Keep batch sizes reasonable (recommended: < 100 orders per request)
2. **Confirmation**: Always require user confirmation before bulk delete operations
3. **Status Validation**: Only transition to valid next states
4. **Error Handling**: Handle partial successes (some orders may fail validation)
5. **CSV Export**: Use appropriate date ranges to avoid generating excessively large files
6. **Socket Events**: Listen for real-time updates to keep UI synchronized

---

## Validation Rules

### Order IDs
- Must be valid MongoDB ObjectIds
- Must belong to the authenticated restaurant
- Array must not be empty

### Status
- Must be one of the valid order statuses
- No additional validation on status transitions (controller allows any valid status)

### Confirmation
- Must be explicitly set to `true` for delete operations
- Case-sensitive boolean value

### Dates (Export)
- Must be valid ISO 8601 format
- End date will include the entire day (set to 23:59:59.999)
