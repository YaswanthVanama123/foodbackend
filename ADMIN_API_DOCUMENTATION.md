# Admin API Documentation

## Table of Contents
1. [Authentication](#authentication)
2. [Dashboard APIs](#dashboard-apis)
3. [Kitchen APIs](#kitchen-apis)
4. [Analytics APIs](#analytics-apis)
5. [Orders APIs](#orders-apis)
6. [Menu APIs](#menu-apis)
7. [Categories APIs](#categories-apis)
8. [Tables APIs](#tables-apis)
9. [Bulk Operations APIs](#bulk-operations-apis)
10. [Error Responses](#error-responses)

---

## Authentication

### Overview
The API uses JWT (JSON Web Tokens) for authentication with multi-tenant support. Each token contains:
- Admin ID
- Restaurant ID (tenant identifier)
- Token type ('admin')
- Expiration time

### Tenant Scoping
All admin endpoints are automatically scoped to the authenticated admin's restaurant. The restaurant context is determined by:
1. Subdomain (e.g., `restaurant1.api.example.com`)
2. Custom domain mapping
3. Restaurant ID in the token

### Token Structure
```json
{
  "id": "admin_id",
  "restaurantId": "restaurant_id",
  "type": "admin",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Headers Required
All authenticated endpoints require:
```
Authorization: Bearer <JWT_TOKEN>
```

### Login Endpoint

#### POST `/api/auth/login`
Authenticate admin user and receive JWT tokens.

**Access:** Public (requires tenant context)

**Request Body:**
```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "admin": {
      "_id": "64abc123...",
      "username": "admin1",
      "email": "admin@restaurant.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "admin",
      "restaurantId": "64xyz789...",
      "isActive": true,
      "permissions": ["manage_orders", "manage_menu", "view_analytics"],
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "restaurant": {
      "_id": "64xyz789...",
      "name": "My Restaurant",
      "subdomain": "myrestaurant"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**
- `400` - Missing username or password
- `401` - Invalid credentials
- `403` - Account is inactive

**cURL Example:**
```bash
curl -X POST https://myrestaurant.api.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin1",
    "password": "password123"
  }'
```

---

#### POST `/api/auth/refresh`
Refresh access token using refresh token.

**Access:** Public

**Request Body:**
```json
{
  "refreshToken": "string (required)"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "new_access_token",
    "refreshToken": "new_refresh_token"
  }
}
```

**Error Responses:**
- `400` - Refresh token required
- `401` - Invalid or expired refresh token
- `403` - Restaurant mismatch

---

#### GET `/api/auth/me`
Get current authenticated admin's information.

**Access:** Private (Admin)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "admin": {
      "_id": "64abc123...",
      "username": "admin1",
      "email": "admin@restaurant.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "admin",
      "restaurantId": "64xyz789...",
      "isActive": true,
      "permissions": []
    },
    "restaurant": {
      "_id": "64xyz789...",
      "name": "My Restaurant",
      "subdomain": "myrestaurant"
    }
  }
}
```

---

#### POST `/api/auth/logout`
Logout admin (client-side token removal).

**Access:** Private (Admin)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Dashboard APIs

### GET `/api/dashboard/stats`
Get comprehensive dashboard statistics for the restaurant.

**Access:** Private (Admin)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "totalOrders": 150,
    "activeOrders": 12,
    "todayRevenue": 2450.50,
    "todayOrders": 45,
    "completedToday": 40,
    "averageOrderValue": 54.45,
    "pendingOrders": 5,
    "preparingOrders": 4,
    "readyOrders": 3
  }
}
```

**cURL Example:**
```bash
curl -X GET https://myrestaurant.api.example.com/api/dashboard/stats \
  -H "Authorization: Bearer <TOKEN>"
```

---

### GET `/api/dashboard/active-orders`
Get all currently active orders.

**Access:** Private (Admin)

**Success Response (200):**
```json
{
  "success": true,
  "count": 12,
  "data": [
    {
      "_id": "64abc123...",
      "orderNumber": "ORD-001",
      "tableNumber": 5,
      "tableId": {
        "_id": "64def456...",
        "tableNumber": 5,
        "location": "Main Hall"
      },
      "status": "preparing",
      "items": [
        {
          "menuItemId": "64ghi789...",
          "name": "Margherita Pizza",
          "quantity": 2,
          "price": 12.99,
          "subtotal": 25.98
        }
      ],
      "subtotal": 25.98,
      "tax": 2.08,
      "total": 28.06,
      "createdAt": "2024-01-01T12:30:00.000Z"
    }
  ]
}
```

---

## Kitchen APIs

### GET `/api/kitchen/orders`
Get all orders for kitchen display (received, preparing, ready).

**Access:** Private (Admin)

**Query Parameters:** None

**Success Response (200):**
```json
{
  "success": true,
  "total": 12,
  "data": {
    "received": [
      {
        "_id": "64abc123...",
        "orderNumber": "ORD-001",
        "tableNumber": 5,
        "tableId": {
          "tableNumber": 5,
          "location": "Main Hall"
        },
        "status": "received",
        "items": [
          {
            "name": "Margherita Pizza",
            "quantity": 2,
            "customizations": ["Extra cheese", "No onions"]
          }
        ],
        "notes": "Customer has allergy to nuts",
        "createdAt": "2024-01-01T12:30:00.000Z"
      }
    ],
    "preparing": [
      {
        "_id": "64def456...",
        "orderNumber": "ORD-002",
        "tableNumber": 3,
        "status": "preparing",
        "items": []
      }
    ],
    "ready": [
      {
        "_id": "64ghi789...",
        "orderNumber": "ORD-003",
        "tableNumber": 7,
        "status": "ready",
        "items": []
      }
    ]
  }
}
```

**cURL Example:**
```bash
curl -X GET https://myrestaurant.api.example.com/api/kitchen/orders \
  -H "Authorization: Bearer <TOKEN>"
```

---

### GET `/api/kitchen/orders/:id`
Get detailed information for a specific order in kitchen display.

**Access:** Private (Admin)

**URL Parameters:**
- `id` - Order ID (MongoDB ObjectId)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123...",
    "orderNumber": "ORD-001",
    "tableNumber": 5,
    "tableId": {
      "tableNumber": 5,
      "location": "Main Hall"
    },
    "status": "preparing",
    "items": [
      {
        "menuItemId": "64xyz...",
        "name": "Margherita Pizza",
        "quantity": 2,
        "price": 12.99,
        "customizations": ["Extra cheese"],
        "subtotal": 25.98
      }
    ],
    "notes": "Customer has allergy to nuts",
    "timeSinceOrder": 15,
    "createdAt": "2024-01-01T12:30:00.000Z"
  }
}
```

**Error Responses:**
- `404` - Order not found

---

### PATCH `/api/kitchen/orders/:id/start`
Mark order as started (received → preparing).

**Access:** Private (Admin)

**URL Parameters:**
- `id` - Order ID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Order started",
  "data": {
    "_id": "64abc123...",
    "orderNumber": "ORD-001",
    "status": "preparing",
    "statusHistory": [
      {
        "status": "received",
        "timestamp": "2024-01-01T12:30:00.000Z"
      },
      {
        "status": "preparing",
        "timestamp": "2024-01-01T12:35:00.000Z",
        "updatedBy": "64admin123..."
      }
    ]
  }
}
```

**Error Responses:**
- `404` - Order not found
- `400` - Cannot start order with current status

**cURL Example:**
```bash
curl -X PATCH https://myrestaurant.api.example.com/api/kitchen/orders/64abc123.../start \
  -H "Authorization: Bearer <TOKEN>"
```

---

### PATCH `/api/kitchen/orders/:id/ready`
Mark order as ready (preparing → ready).

**Access:** Private (Admin)

**URL Parameters:**
- `id` - Order ID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Order marked as ready",
  "data": {
    "_id": "64abc123...",
    "orderNumber": "ORD-001",
    "status": "ready",
    "statusHistory": [
      {
        "status": "received",
        "timestamp": "2024-01-01T12:30:00.000Z"
      },
      {
        "status": "preparing",
        "timestamp": "2024-01-01T12:35:00.000Z"
      },
      {
        "status": "ready",
        "timestamp": "2024-01-01T12:45:00.000Z",
        "updatedBy": "64admin123..."
      }
    ]
  }
}
```

**Error Responses:**
- `404` - Order not found
- `400` - Cannot mark as ready with current status

---

### GET `/api/kitchen/stats`
Get kitchen statistics for the current day.

**Access:** Private (Admin)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "pendingOrders": 5,
    "preparingOrders": 8,
    "completedToday": 42,
    "averagePreparationTime": 18
  }
}
```

---

## Analytics APIs

### GET `/api/analytics/revenue`
Get revenue analytics with flexible time periods.

**Access:** Private (Admin)

**Query Parameters:**
- `period` - Time period: 'today', 'week', 'month', 'custom' (default: 'today')
- `startDate` - Start date for custom period (ISO format)
- `endDate` - End date for custom period (ISO format)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "totalRevenue": 15420.50,
    "totalOrders": 342,
    "averageOrderValue": "45.09",
    "ordersByStatus": [
      {
        "_id": "served",
        "count": 320,
        "revenue": 15420.50
      },
      {
        "_id": "cancelled",
        "count": 22,
        "revenue": 0
      }
    ],
    "dailyRevenue": [
      {
        "_id": "2024-01-01",
        "revenue": 2450.50,
        "orders": 54
      },
      {
        "_id": "2024-01-02",
        "revenue": 2680.75,
        "orders": 58
      }
    ]
  }
}
```

**cURL Example:**
```bash
# Today's revenue
curl -X GET "https://myrestaurant.api.example.com/api/analytics/revenue?period=today" \
  -H "Authorization: Bearer <TOKEN>"

# Custom date range
curl -X GET "https://myrestaurant.api.example.com/api/analytics/revenue?period=custom&startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer <TOKEN>"
```

---

### GET `/api/analytics/popular-items`
Get most popular menu items by order count.

**Access:** Private (Admin)

**Query Parameters:**
- `period` - Time period: 'today', 'week', 'month' (default: 'month')
- `limit` - Number of items to return (default: 10)

**Success Response (200):**
```json
{
  "success": true,
  "period": "month",
  "count": 10,
  "data": [
    {
      "_id": "64abc123...",
      "name": "Margherita Pizza",
      "totalOrders": 245,
      "totalRevenue": 3183.55
    },
    {
      "_id": "64def456...",
      "name": "Caesar Salad",
      "totalOrders": 187,
      "totalRevenue": 1683.00
    }
  ]
}
```

**cURL Example:**
```bash
curl -X GET "https://myrestaurant.api.example.com/api/analytics/popular-items?period=week&limit=5" \
  -H "Authorization: Bearer <TOKEN>"
```

---

### GET `/api/analytics/category-performance`
Get sales performance by menu category.

**Access:** Private (Admin)

**Query Parameters:**
- `period` - Time period: 'today', 'week', 'month' (default: 'month')

**Success Response (200):**
```json
{
  "success": true,
  "period": "month",
  "data": [
    {
      "categoryId": "64abc123...",
      "categoryName": "Pizzas",
      "totalOrders": 450,
      "totalRevenue": 5847.50,
      "itemsSold": 892
    },
    {
      "categoryId": "64def456...",
      "categoryName": "Salads",
      "totalOrders": 234,
      "totalRevenue": 2106.00,
      "itemsSold": 345
    }
  ]
}
```

---

### GET `/api/analytics/peak-hours`
Get order volume and revenue by hour of day.

**Access:** Private (Admin)

**Query Parameters:**
- `period` - Time period: 'today', 'week', 'month' (default: 'week')

**Success Response (200):**
```json
{
  "success": true,
  "period": "week",
  "data": [
    {
      "hour": 12,
      "orderCount": 45,
      "revenue": 2034.50
    },
    {
      "hour": 13,
      "orderCount": 52,
      "revenue": 2458.75
    },
    {
      "hour": 18,
      "orderCount": 67,
      "revenue": 3124.25
    }
  ]
}
```

---

### GET `/api/analytics/table-performance`
Get performance metrics by table.

**Access:** Private (Admin)

**Query Parameters:**
- `period` - Time period: 'today', 'week', 'month' (default: 'month')

**Success Response (200):**
```json
{
  "success": true,
  "period": "month",
  "data": [
    {
      "_id": 5,
      "orderCount": 89,
      "totalRevenue": 4023.45,
      "avgOrderValue": 45.21
    },
    {
      "_id": 3,
      "orderCount": 76,
      "totalRevenue": 3456.80,
      "avgOrderValue": 45.48
    }
  ]
}
```

---

### GET `/api/analytics/preparation-time`
Get average order preparation time metrics.

**Access:** Private (Admin)

**Query Parameters:**
- `period` - Time period: 'today', 'week', 'month' (default: 'week')

**Success Response (200):**
```json
{
  "success": true,
  "period": "week",
  "data": {
    "averageTotalTime": 18,
    "totalOrders": 234,
    "timings": [
      {
        "totalTime": 15,
        "statusTimes": {
          "received": 2,
          "preparing": 10,
          "ready": 3
        }
      }
    ]
  }
}
```

---

### GET `/api/analytics/dashboard`
Get comprehensive analytics for dashboard overview.

**Access:** Private (Admin)

**Query Parameters:** None (always shows today's data)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "today": {
      "totalOrders": 45,
      "completedOrders": 40,
      "totalRevenue": 2034.50,
      "avgOrderValue": 50.86
    },
    "activeOrders": 12,
    "popularItems": [
      {
        "_id": "Margherita Pizza",
        "count": 15
      },
      {
        "_id": "Caesar Salad",
        "count": 12
      }
    ],
    "recentOrders": [
      {
        "_id": "64abc123...",
        "orderNumber": "ORD-045",
        "tableNumber": 5,
        "total": 45.99,
        "status": "served",
        "createdAt": "2024-01-01T12:30:00.000Z"
      }
    ],
    "categoryBreakdown": {
      "totalItems": 123
    }
  }
}
```

---

## Orders APIs

### GET `/api/orders`
Get all orders with pagination and filtering.

**Access:** Private (Admin)

**Query Parameters:**
- `status` - Filter by status: 'received', 'preparing', 'ready', 'served', 'cancelled'
- `tableId` - Filter by table ID
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)

**Success Response (200):**
```json
{
  "success": true,
  "count": 50,
  "total": 342,
  "page": 1,
  "pages": 7,
  "data": [
    {
      "_id": "64abc123...",
      "orderNumber": "ORD-001",
      "restaurantId": "64xyz789...",
      "tableNumber": 5,
      "tableId": {
        "_id": "64def456...",
        "tableNumber": 5,
        "location": "Main Hall"
      },
      "status": "served",
      "items": [
        {
          "menuItemId": "64ghi789...",
          "name": "Margherita Pizza",
          "quantity": 2,
          "price": 12.99,
          "customizations": [],
          "subtotal": 25.98
        }
      ],
      "subtotal": 25.98,
      "tax": 2.08,
      "total": 28.06,
      "notes": "",
      "statusHistory": [],
      "createdAt": "2024-01-01T12:30:00.000Z",
      "servedAt": "2024-01-01T13:00:00.000Z"
    }
  ]
}
```

**cURL Example:**
```bash
# Get all orders
curl -X GET "https://myrestaurant.api.example.com/api/orders?page=1&limit=20" \
  -H "Authorization: Bearer <TOKEN>"

# Filter by status
curl -X GET "https://myrestaurant.api.example.com/api/orders?status=preparing" \
  -H "Authorization: Bearer <TOKEN>"
```

---

### GET `/api/orders/active`
Get all active orders (received, preparing, ready).

**Access:** Private (Admin)

**Success Response (200):**
```json
{
  "success": true,
  "count": 12,
  "data": [
    {
      "_id": "64abc123...",
      "orderNumber": "ORD-001",
      "tableNumber": 5,
      "status": "preparing",
      "items": [],
      "total": 28.06,
      "createdAt": "2024-01-01T12:30:00.000Z"
    }
  ]
}
```

---

### GET `/api/orders/history`
Get order history (served and cancelled orders).

**Access:** Private (Admin)

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `startDate` - Filter from date (ISO format)
- `endDate` - Filter to date (ISO format)

**Success Response (200):**
```json
{
  "success": true,
  "count": 20,
  "total": 342,
  "page": 1,
  "pages": 18,
  "data": [
    {
      "_id": "64abc123...",
      "orderNumber": "ORD-001",
      "tableNumber": 5,
      "status": "served",
      "total": 28.06,
      "createdAt": "2024-01-01T12:30:00.000Z",
      "servedAt": "2024-01-01T13:00:00.000Z"
    }
  ]
}
```

---

### GET `/api/orders/:id`
Get single order by ID.

**Access:** Public (tenant-scoped)

**URL Parameters:**
- `id` - Order ID (MongoDB ObjectId)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123...",
    "orderNumber": "ORD-001",
    "restaurantId": "64xyz789...",
    "tableNumber": 5,
    "tableId": {
      "_id": "64def456...",
      "tableNumber": 5,
      "location": "Main Hall"
    },
    "status": "served",
    "items": [
      {
        "menuItemId": "64ghi789...",
        "name": "Margherita Pizza",
        "quantity": 2,
        "price": 12.99,
        "customizations": ["Extra cheese"],
        "subtotal": 25.98
      }
    ],
    "subtotal": 25.98,
    "tax": 2.08,
    "total": 28.06,
    "notes": "Customer has allergy to nuts",
    "statusHistory": [
      {
        "status": "received",
        "timestamp": "2024-01-01T12:30:00.000Z"
      },
      {
        "status": "preparing",
        "timestamp": "2024-01-01T12:35:00.000Z",
        "updatedBy": "64admin123..."
      }
    ],
    "createdAt": "2024-01-01T12:30:00.000Z"
  }
}
```

**Error Responses:**
- `404` - Order not found

---

### GET `/api/orders/table/:tableId`
Get all orders for a specific table.

**Access:** Public (tenant-scoped)

**URL Parameters:**
- `tableId` - Table ID (MongoDB ObjectId)

**Success Response (200):**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "_id": "64abc123...",
      "orderNumber": "ORD-001",
      "tableNumber": 5,
      "status": "preparing",
      "total": 28.06
    }
  ]
}
```

---

### POST `/api/orders`
Create a new order.

**Access:** Public (tenant-scoped, supports optional customer authentication)

**Request Body:**
```json
{
  "tableId": "64def456...",
  "items": [
    {
      "menuItemId": "64ghi789...",
      "name": "Margherita Pizza",
      "quantity": 2,
      "price": 12.99,
      "customizations": [
        {
          "name": "Extra cheese",
          "price": 1.50
        }
      ]
    }
  ],
  "notes": "Customer has allergy to nuts"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123...",
    "orderNumber": "ORD-001",
    "restaurantId": "64xyz789...",
    "tableNumber": 5,
    "tableId": {
      "_id": "64def456...",
      "tableNumber": 5,
      "location": "Main Hall"
    },
    "customerId": "64customer123...",
    "status": "received",
    "items": [
      {
        "menuItemId": "64ghi789...",
        "name": "Margherita Pizza",
        "quantity": 2,
        "price": 12.99,
        "customizations": [
          {
            "name": "Extra cheese",
            "price": 1.50
          }
        ],
        "subtotal": 28.98
      }
    ],
    "subtotal": 28.98,
    "tax": 2.32,
    "total": 31.30,
    "notes": "Customer has allergy to nuts",
    "statusHistory": [
      {
        "status": "received",
        "timestamp": "2024-01-01T12:30:00.000Z"
      }
    ],
    "createdAt": "2024-01-01T12:30:00.000Z"
  }
}
```

**Error Responses:**
- `404` - Table not found
- `400` - Table is not active
- `400` - Validation errors

**cURL Example:**
```bash
curl -X POST https://myrestaurant.api.example.com/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tableId": "64def456...",
    "items": [
      {
        "menuItemId": "64ghi789...",
        "name": "Margherita Pizza",
        "quantity": 2,
        "price": 12.99,
        "customizations": []
      }
    ],
    "notes": ""
  }'
```

---

### PATCH `/api/orders/:id/status`
Update order status.

**Access:** Private (Admin)

**URL Parameters:**
- `id` - Order ID

**Request Body:**
```json
{
  "status": "preparing"
}
```

**Valid Status Transitions:**
- received → preparing
- preparing → ready
- ready → served
- any → cancelled

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123...",
    "orderNumber": "ORD-001",
    "status": "preparing",
    "statusHistory": [
      {
        "status": "received",
        "timestamp": "2024-01-01T12:30:00.000Z"
      },
      {
        "status": "preparing",
        "timestamp": "2024-01-01T12:35:00.000Z",
        "updatedBy": "64admin123..."
      }
    ]
  }
}
```

**Error Responses:**
- `404` - Order not found
- `400` - Invalid status transition

---

### DELETE `/api/orders/:id`
Cancel an order.

**Access:** Private (Admin)

**URL Parameters:**
- `id` - Order ID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "data": {
    "_id": "64abc123...",
    "orderNumber": "ORD-001",
    "status": "cancelled",
    "statusHistory": [
      {
        "status": "received",
        "timestamp": "2024-01-01T12:30:00.000Z"
      },
      {
        "status": "cancelled",
        "timestamp": "2024-01-01T12:40:00.000Z",
        "updatedBy": "64admin123..."
      }
    ]
  }
}
```

**Error Responses:**
- `404` - Order not found
- `400` - Cannot cancel order with status 'served' or 'cancelled'

---

### POST `/api/orders/:id/items`
Add items to existing order.

**Access:** Private (Admin)

**URL Parameters:**
- `id` - Order ID

**Request Body:**
```json
{
  "items": [
    {
      "menuItemId": "64xyz...",
      "name": "Caesar Salad",
      "quantity": 1,
      "price": 9.99,
      "customizations": []
    }
  ]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "1 items added to order",
  "data": {
    "_id": "64abc123...",
    "orderNumber": "ORD-001",
    "items": [],
    "subtotal": 38.97,
    "tax": 3.12,
    "total": 42.09
  }
}
```

**Error Responses:**
- `404` - Order not found
- `400` - Cannot add items to served/cancelled order

---

### DELETE `/api/orders/:id/items/:itemIndex`
Remove item from order.

**Access:** Private (Admin)

**URL Parameters:**
- `id` - Order ID
- `itemIndex` - Index of item in items array (0-based)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Item removed from order",
  "data": {
    "_id": "64abc123...",
    "orderNumber": "ORD-001",
    "items": [],
    "subtotal": 25.98,
    "tax": 2.08,
    "total": 28.06
  }
}
```

**Error Responses:**
- `404` - Order not found
- `400` - Can only remove items from 'received' orders
- `400` - Invalid item index

---

### PATCH `/api/orders/:id/items/:itemIndex/quantity`
Update quantity of specific item in order.

**Access:** Private (Admin)

**URL Parameters:**
- `id` - Order ID
- `itemIndex` - Index of item in items array (0-based)

**Request Body:**
```json
{
  "quantity": 3
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Item quantity updated",
  "data": {
    "_id": "64abc123...",
    "orderNumber": "ORD-001",
    "items": [
      {
        "menuItemId": "64ghi789...",
        "name": "Margherita Pizza",
        "quantity": 3,
        "price": 12.99,
        "subtotal": 38.97
      }
    ],
    "subtotal": 38.97,
    "tax": 3.12,
    "total": 42.09
  }
}
```

**Error Responses:**
- `404` - Order not found
- `400` - Can only update quantity for 'received' orders
- `400` - Quantity must be at least 1
- `400` - Invalid item index

---

### PATCH `/api/orders/:id/notes`
Add or update notes on order.

**Access:** Public (no authentication required)

**URL Parameters:**
- `id` - Order ID

**Request Body:**
```json
{
  "notes": "Please bring extra napkins"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Notes updated",
  "data": {
    "_id": "64abc123...",
    "orderNumber": "ORD-001",
    "notes": "Please bring extra napkins"
  }
}
```

---

### POST `/api/orders/:id/duplicate`
Duplicate an order (reorder).

**Access:** Public

**URL Parameters:**
- `id` - Original order ID

**Request Body:**
```json
{
  "tableId": "64def456..."
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Order duplicated successfully",
  "data": {
    "_id": "64new123...",
    "orderNumber": "ORD-045",
    "tableNumber": 5,
    "items": [],
    "notes": "Reorder of ORD-001",
    "status": "received",
    "total": 28.06
  }
}
```

---

### GET `/api/orders/:id/modifications`
Get order modification history.

**Access:** Private (Admin)

**URL Parameters:**
- `id` - Order ID

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "statusHistory": [
      {
        "status": "received",
        "timestamp": "2024-01-01T12:30:00.000Z"
      },
      {
        "status": "preparing",
        "timestamp": "2024-01-01T12:35:00.000Z",
        "updatedBy": "64admin123..."
      },
      {
        "status": "ready",
        "timestamp": "2024-01-01T12:45:00.000Z",
        "updatedBy": "64admin123..."
      }
    ],
    "createdAt": "2024-01-01T12:30:00.000Z",
    "updatedAt": "2024-01-01T12:45:00.000Z"
  }
}
```

---

## Menu APIs

### GET `/api/menu`
Get all menu items.

**Access:** Public (tenant-scoped)

**Query Parameters:**
- `categoryId` - Filter by category ID
- `available` - Filter by availability ('true' to show only available)

**Success Response (200):**
```json
{
  "success": true,
  "count": 25,
  "data": [
    {
      "_id": "64abc123...",
      "restaurantId": "64xyz789...",
      "name": "Margherita Pizza",
      "description": "Classic pizza with tomato sauce and mozzarella",
      "categoryId": {
        "_id": "64cat123...",
        "name": "Pizzas"
      },
      "price": 12.99,
      "image": "/uploads/menu-items/pizza.jpg",
      "isAvailable": true,
      "isVegetarian": true,
      "isVegan": false,
      "isGlutenFree": false,
      "customizationOptions": [
        {
          "name": "Extra cheese",
          "price": 1.50
        },
        {
          "name": "Olives",
          "price": 1.00
        }
      ],
      "preparationTime": 15,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**cURL Example:**
```bash
# Get all menu items
curl -X GET https://myrestaurant.api.example.com/api/menu

# Get available items only
curl -X GET "https://myrestaurant.api.example.com/api/menu?available=true"

# Get items by category
curl -X GET "https://myrestaurant.api.example.com/api/menu?categoryId=64cat123..."
```

---

### GET `/api/menu/category/:categoryId`
Get menu items by category.

**Access:** Public (tenant-scoped)

**URL Parameters:**
- `categoryId` - Category ID

**Success Response (200):**
```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "_id": "64abc123...",
      "name": "Margherita Pizza",
      "description": "Classic pizza",
      "categoryId": {
        "_id": "64cat123...",
        "name": "Pizzas"
      },
      "price": 12.99,
      "isAvailable": true
    }
  ]
}
```

---

### GET `/api/menu/:id`
Get single menu item by ID.

**Access:** Public (tenant-scoped)

**URL Parameters:**
- `id` - Menu item ID

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123...",
    "restaurantId": "64xyz789...",
    "name": "Margherita Pizza",
    "description": "Classic pizza with tomato sauce and mozzarella",
    "categoryId": {
      "_id": "64cat123...",
      "name": "Pizzas"
    },
    "price": 12.99,
    "image": "/uploads/menu-items/pizza.jpg",
    "isAvailable": true,
    "isVegetarian": true,
    "isVegan": false,
    "isGlutenFree": false,
    "customizationOptions": [
      {
        "name": "Extra cheese",
        "price": 1.50
      }
    ],
    "preparationTime": 15
  }
}
```

**Error Responses:**
- `404` - Menu item not found

---

### POST `/api/menu`
Create new menu item.

**Access:** Private (Admin)

**Request Body:**
```json
{
  "name": "Margherita Pizza",
  "description": "Classic pizza with tomato sauce and mozzarella",
  "categoryId": "64cat123...",
  "price": 12.99,
  "isVegetarian": true,
  "isVegan": false,
  "isGlutenFree": false,
  "customizationOptions": [
    {
      "name": "Extra cheese",
      "price": 1.50
    }
  ],
  "preparationTime": 15
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123...",
    "restaurantId": "64xyz789...",
    "name": "Margherita Pizza",
    "description": "Classic pizza with tomato sauce and mozzarella",
    "categoryId": "64cat123...",
    "price": 12.99,
    "isAvailable": true,
    "isVegetarian": true,
    "isVegan": false,
    "isGlutenFree": false,
    "customizationOptions": [
      {
        "name": "Extra cheese",
        "price": 1.50
      }
    ],
    "preparationTime": 15,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Name, category, and price are required

**cURL Example:**
```bash
curl -X POST https://myrestaurant.api.example.com/api/menu \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Margherita Pizza",
    "description": "Classic pizza",
    "categoryId": "64cat123...",
    "price": 12.99,
    "isVegetarian": true,
    "preparationTime": 15
  }'
```

---

### PUT `/api/menu/:id`
Update menu item.

**Access:** Private (Admin)

**URL Parameters:**
- `id` - Menu item ID

**Request Body:** (all fields optional)
```json
{
  "name": "Margherita Pizza",
  "description": "Updated description",
  "categoryId": "64cat123...",
  "price": 13.99,
  "isAvailable": true,
  "isVegetarian": true,
  "isVegan": false,
  "isGlutenFree": false,
  "customizationOptions": [
    {
      "name": "Extra cheese",
      "price": 2.00
    }
  ],
  "preparationTime": 20
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123...",
    "name": "Margherita Pizza",
    "price": 13.99,
    "isAvailable": true
  }
}
```

**Error Responses:**
- `404` - Menu item not found

---

### DELETE `/api/menu/:id`
Delete menu item.

**Access:** Private (Admin)

**URL Parameters:**
- `id` - Menu item ID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Menu item deleted successfully"
}
```

**Error Responses:**
- `404` - Menu item not found

---

### PATCH `/api/menu/:id/availability`
Toggle menu item availability.

**Access:** Private (Admin)

**URL Parameters:**
- `id` - Menu item ID

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123...",
    "name": "Margherita Pizza",
    "isAvailable": false
  }
}
```

**Error Responses:**
- `404` - Menu item not found

**cURL Example:**
```bash
curl -X PATCH https://myrestaurant.api.example.com/api/menu/64abc123.../availability \
  -H "Authorization: Bearer <TOKEN>"
```

---

### POST `/api/menu/:id/image`
Upload menu item image.

**Access:** Private (Admin)

**URL Parameters:**
- `id` - Menu item ID

**Request:** `multipart/form-data`
- `image` - Image file (field name)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123...",
    "name": "Margherita Pizza",
    "image": "/uploads/menu-items/1234567890-pizza.jpg"
  }
}
```

**Error Responses:**
- `404` - Menu item not found
- `400` - No image file uploaded

**cURL Example:**
```bash
curl -X POST https://myrestaurant.api.example.com/api/menu/64abc123.../image \
  -H "Authorization: Bearer <TOKEN>" \
  -F "image=@/path/to/pizza.jpg"
```

---

## Categories APIs

### GET `/api/categories`
Get all categories.

**Access:** Public (tenant-scoped)

**Query Parameters:**
- `includeInactive` - Include inactive categories ('true' to include)

**Success Response (200):**
```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "_id": "64abc123...",
      "restaurantId": "64xyz789...",
      "name": "Pizzas",
      "description": "Wood-fired pizzas",
      "displayOrder": 1,
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "_id": "64def456...",
      "restaurantId": "64xyz789...",
      "name": "Salads",
      "description": "Fresh salads",
      "displayOrder": 2,
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**cURL Example:**
```bash
curl -X GET https://myrestaurant.api.example.com/api/categories
```

---

### GET `/api/categories/:id`
Get single category by ID.

**Access:** Public (tenant-scoped)

**URL Parameters:**
- `id` - Category ID

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123...",
    "restaurantId": "64xyz789...",
    "name": "Pizzas",
    "description": "Wood-fired pizzas",
    "displayOrder": 1,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `404` - Category not found

---

### POST `/api/categories`
Create new category.

**Access:** Private (Admin)

**Request Body:**
```json
{
  "name": "Pizzas",
  "description": "Wood-fired pizzas",
  "displayOrder": 1,
  "isActive": true
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123...",
    "restaurantId": "64xyz789...",
    "name": "Pizzas",
    "description": "Wood-fired pizzas",
    "displayOrder": 1,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Category name is required

**cURL Example:**
```bash
curl -X POST https://myrestaurant.api.example.com/api/categories \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pizzas",
    "description": "Wood-fired pizzas",
    "displayOrder": 1
  }'
```

---

### PUT `/api/categories/:id`
Update category.

**Access:** Private (Admin)

**URL Parameters:**
- `id` - Category ID

**Request Body:** (all fields optional)
```json
{
  "name": "Italian Pizzas",
  "description": "Authentic Italian pizzas",
  "displayOrder": 1,
  "isActive": true
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123...",
    "name": "Italian Pizzas",
    "description": "Authentic Italian pizzas",
    "displayOrder": 1,
    "isActive": true
  }
}
```

**Error Responses:**
- `404` - Category not found

---

### DELETE `/api/categories/:id`
Delete category.

**Access:** Private (Admin)

**URL Parameters:**
- `id` - Category ID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Category deleted successfully"
}
```

**Error Responses:**
- `404` - Category not found

---

### PATCH `/api/categories/:id/toggle`
Toggle category active status.

**Access:** Private (Admin)

**URL Parameters:**
- `id` - Category ID

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123...",
    "name": "Pizzas",
    "isActive": false
  }
}
```

**Error Responses:**
- `404` - Category not found

---

## Tables APIs

### GET `/api/tables`
Get all tables.

**Access:** Public (tenant-scoped)

**Query Parameters:**
- `includeInactive` - Include inactive tables ('true' to include)

**Success Response (200):**
```json
{
  "success": true,
  "count": 15,
  "data": [
    {
      "_id": "64abc123...",
      "restaurantId": "64xyz789...",
      "tableNumber": 1,
      "capacity": 4,
      "location": "Main Hall",
      "isActive": true,
      "isOccupied": false,
      "currentOrderId": null,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "_id": "64def456...",
      "restaurantId": "64xyz789...",
      "tableNumber": 2,
      "capacity": 2,
      "location": "Window Side",
      "isActive": true,
      "isOccupied": true,
      "currentOrderId": "64order123...",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**cURL Example:**
```bash
curl -X GET https://myrestaurant.api.example.com/api/tables
```

---

### GET `/api/tables/:id`
Get single table by ID.

**Access:** Public (tenant-scoped)

**URL Parameters:**
- `id` - Table ID

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123...",
    "restaurantId": "64xyz789...",
    "tableNumber": 1,
    "capacity": 4,
    "location": "Main Hall",
    "isActive": true,
    "isOccupied": false,
    "currentOrderId": null
  }
}
```

**Error Responses:**
- `404` - Table not found

---

### GET `/api/tables/:id/status`
Get table status (simplified).

**Access:** Public (tenant-scoped)

**URL Parameters:**
- `id` - Table ID

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "tableNumber": 1,
    "isAvailable": true,
    "isOccupied": false
  }
}
```

**Error Responses:**
- `404` - Table not found

---

### POST `/api/tables`
Create new table.

**Access:** Private (Admin)

**Request Body:**
```json
{
  "tableNumber": 1,
  "capacity": 4,
  "location": "Main Hall",
  "isActive": true
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123...",
    "restaurantId": "64xyz789...",
    "tableNumber": 1,
    "capacity": 4,
    "location": "Main Hall",
    "isActive": true,
    "isOccupied": false,
    "currentOrderId": null,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Table number and capacity are required

**cURL Example:**
```bash
curl -X POST https://myrestaurant.api.example.com/api/tables \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": 1,
    "capacity": 4,
    "location": "Main Hall"
  }'
```

---

### PUT `/api/tables/:id`
Update table.

**Access:** Private (Admin)

**URL Parameters:**
- `id` - Table ID

**Request Body:** (all fields optional)
```json
{
  "tableNumber": 1,
  "capacity": 6,
  "location": "VIP Section",
  "isActive": true,
  "isOccupied": false
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123...",
    "tableNumber": 1,
    "capacity": 6,
    "location": "VIP Section",
    "isActive": true,
    "isOccupied": false
  }
}
```

**Error Responses:**
- `404` - Table not found

---

### DELETE `/api/tables/:id`
Delete table.

**Access:** Private (Admin)

**URL Parameters:**
- `id` - Table ID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Table deleted successfully"
}
```

**Error Responses:**
- `404` - Table not found

---

### PATCH `/api/tables/:id/toggle`
Toggle table active status.

**Access:** Private (Admin)

**URL Parameters:**
- `id` - Table ID

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123...",
    "tableNumber": 1,
    "isActive": false
  }
}
```

**Error Responses:**
- `404` - Table not found

---

## Bulk Operations APIs

### PATCH `/api/bulk/menu/availability`
Bulk update menu item availability.

**Access:** Private (Admin)

**Request Body:**
```json
{
  "itemIds": ["64abc123...", "64def456...", "64ghi789..."],
  "isAvailable": false
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "3 items updated",
  "data": {
    "matched": 3,
    "modified": 3
  }
}
```

**Error Responses:**
- `400` - Item IDs array is required
- `400` - isAvailable must be a boolean

**cURL Example:**
```bash
curl -X PATCH https://myrestaurant.api.example.com/api/bulk/menu/availability \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "itemIds": ["64abc123...", "64def456..."],
    "isAvailable": false
  }'
```

---

### PATCH `/api/bulk/menu/prices`
Bulk update menu item prices.

**Access:** Private (Admin)

**Request Body:**
```json
{
  "updates": [
    {
      "itemId": "64abc123...",
      "price": 14.99
    },
    {
      "itemId": "64def456...",
      "price": 10.99
    }
  ]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "2 prices updated",
  "data": {
    "matched": 2,
    "modified": 2
  }
}
```

**Error Responses:**
- `400` - Updates array is required

**cURL Example:**
```bash
curl -X PATCH https://myrestaurant.api.example.com/api/bulk/menu/prices \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {"itemId": "64abc123...", "price": 14.99},
      {"itemId": "64def456...", "price": 10.99}
    ]
  }'
```

---

### PATCH `/api/bulk/menu/category`
Bulk move menu items to different category.

**Access:** Private (Admin)

**Request Body:**
```json
{
  "itemIds": ["64abc123...", "64def456..."],
  "categoryId": "64newcat123..."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "2 items moved to Appetizers",
  "data": {
    "matched": 2,
    "modified": 2
  }
}
```

**Error Responses:**
- `400` - Item IDs array is required
- `400` - Category ID is required
- `404` - Category not found

---

### DELETE `/api/bulk/menu`
Bulk delete menu items.

**Access:** Private (Admin)

**Request Body:**
```json
{
  "itemIds": ["64abc123...", "64def456...", "64ghi789..."]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "3 items deleted",
  "data": {
    "deleted": 3
  }
}
```

**Error Responses:**
- `400` - Item IDs array is required

---

### PATCH `/api/bulk/tables/status`
Bulk update table status.

**Access:** Private (Admin)

**Request Body:**
```json
{
  "tableIds": ["64abc123...", "64def456..."],
  "isActive": false
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "2 tables updated",
  "data": {
    "matched": 2,
    "modified": 2
  }
}
```

**Error Responses:**
- `400` - Table IDs array is required
- `400` - isActive must be a boolean

---

### POST `/api/bulk/orders/export`
Export orders to CSV format data.

**Access:** Private (Admin)

**Request Body:**
```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "status": "served"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "count": 156,
  "data": [
    {
      "orderNumber": "ORD-001",
      "tableNumber": 5,
      "date": "1/1/2024, 12:30:00 PM",
      "items": "Margherita Pizza (2); Caesar Salad (1)",
      "subtotal": 35.97,
      "tax": 2.88,
      "total": 38.85,
      "status": "served",
      "servedAt": "1/1/2024, 1:00:00 PM"
    }
  ]
}
```

**cURL Example:**
```bash
curl -X POST https://myrestaurant.api.example.com/api/bulk/orders/export \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "status": "served"
  }'
```

---

### GET `/api/bulk/summary`
Get summary of all bulk-manageable resources.

**Access:** Private (Admin)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "menuItems": {
      "total": 45,
      "available": 42,
      "unavailable": 3
    },
    "tables": {
      "total": 20,
      "active": 18,
      "inactive": 2
    },
    "categories": {
      "total": 8
    }
  }
}
```

---

## Error Responses

### Common Error Response Format
All error responses follow this structure:

```json
{
  "success": false,
  "message": "Error message",
  "code": "ERROR_CODE",
  "error": "Detailed error (in development)"
}
```

### HTTP Status Codes

#### 400 Bad Request
Invalid request data or validation errors.

```json
{
  "success": false,
  "message": "Please provide username and password"
}
```

#### 401 Unauthorized
Authentication required or invalid token.

```json
{
  "success": false,
  "message": "No token provided. Please login.",
  "code": "NO_TOKEN"
}
```

```json
{
  "success": false,
  "message": "Token expired. Please login again.",
  "code": "TOKEN_EXPIRED"
}
```

#### 403 Forbidden
Insufficient permissions or tenant mismatch.

```json
{
  "success": false,
  "message": "Access denied. Token restaurant mismatch.",
  "code": "RESTAURANT_MISMATCH"
}
```

```json
{
  "success": false,
  "message": "Account is inactive. Please contact your administrator.",
  "code": "ACCOUNT_INACTIVE"
}
```

#### 404 Not Found
Resource not found.

```json
{
  "success": false,
  "message": "Order not found"
}
```

#### 500 Internal Server Error
Server error.

```json
{
  "success": false,
  "message": "Server error",
  "error": "Detailed error message"
}
```

### Authentication Error Codes

| Code | Description |
|------|-------------|
| `NO_TOKEN` | Authorization header missing or invalid |
| `INVALID_TOKEN` | JWT token is invalid |
| `TOKEN_EXPIRED` | JWT token has expired |
| `INVALID_TOKEN_TYPE` | Token type doesn't match endpoint requirement |
| `MISSING_RESTAURANT_ID` | Token missing restaurant context |
| `RESTAURANT_MISMATCH` | Token restaurant doesn't match request context |
| `ADMIN_NOT_FOUND` | Admin not found in database |
| `ACCOUNT_INACTIVE` | Admin account is deactivated |
| `AUTH_ERROR` | Generic authentication error |

---

## Rate Limiting

Currently not implemented. Consider implementing rate limiting for production:
- 100 requests per minute per IP for public endpoints
- 1000 requests per minute per admin for authenticated endpoints

---

## Postman Collection

### Setup
1. Create a new environment in Postman
2. Add variables:
   - `BASE_URL`: `https://myrestaurant.api.example.com`
   - `TOKEN`: (will be set after login)

### Pre-request Script for Authentication
Add this to collection or folder level:

```javascript
// Auto-refresh token if expired
if (pm.environment.get("TOKEN")) {
    const token = pm.environment.get("TOKEN");
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;

    if (Date.now() >= exp) {
        console.log("Token expired, refreshing...");
        // Trigger refresh token request
    }
}
```

### Common Requests

#### 1. Login and Save Token
```javascript
// Request
POST {{BASE_URL}}/api/auth/login
Body: {
  "username": "admin1",
  "password": "password123"
}

// Test script
pm.test("Login successful", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.success).to.eql(true);
    pm.environment.set("TOKEN", jsonData.data.token);
    pm.environment.set("REFRESH_TOKEN", jsonData.data.refreshToken);
});
```

#### 2. Authenticated Request Template
```javascript
GET {{BASE_URL}}/api/orders/active
Headers: Authorization: Bearer {{TOKEN}}
```

---

## WebSocket Events

The API uses Socket.IO for real-time updates. All events are scoped to restaurant namespaces.

### Namespace Format
```
/restaurant/:restaurantId
```

### Admin Events (Admin Room)

#### `new_order`
New order created.

```json
{
  "orderId": "64abc123...",
  "orderNumber": "ORD-001",
  "tableNumber": 5,
  "items": [],
  "total": 28.06,
  "status": "received",
  "createdAt": "2024-01-01T12:30:00.000Z"
}
```

#### `order_status_change`
Order status updated.

```json
{
  "_id": "64abc123...",
  "orderNumber": "ORD-001",
  "status": "preparing",
  "tableNumber": 5
}
```

### Customer Events (Table Room)

#### `order_status_update`
Order status update for specific table.

```json
{
  "_id": "64abc123...",
  "orderNumber": "ORD-001",
  "status": "ready",
  "items": []
}
```

### Connection Example
```javascript
import io from 'socket.io-client';

const socket = io('https://api.example.com/restaurant/64xyz789...', {
  auth: {
    token: 'JWT_TOKEN'
  }
});

// Join admin room
socket.emit('join_admin_room');

// Listen for new orders
socket.on('new_order', (order) => {
  console.log('New order:', order);
});

// Listen for status changes
socket.on('order_status_change', (order) => {
  console.log('Order updated:', order);
});
```

---

## Best Practices

### 1. Token Management
- Store tokens securely (localStorage for web, secure storage for mobile)
- Implement automatic token refresh before expiration
- Clear tokens on logout
- Handle 401 responses by redirecting to login

### 2. Error Handling
```javascript
try {
  const response = await fetch('/api/orders', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired, refresh or redirect to login
      return handleTokenExpired();
    }

    const error = await response.json();
    throw new Error(error.message);
  }

  const data = await response.json();
  return data;
} catch (error) {
  console.error('API Error:', error);
  // Handle error appropriately
}
```

### 3. Pagination
Always use pagination for list endpoints to improve performance:
```javascript
// Fetch orders page by page
const fetchOrders = async (page = 1, limit = 50) => {
  const response = await fetch(
    `/api/orders?page=${page}&limit=${limit}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return response.json();
};
```

### 4. Optimistic Updates
For better UX, update UI optimistically:
```javascript
// Update UI immediately
updateOrderStatusInUI(orderId, 'preparing');

// Then sync with server
try {
  await updateOrderStatus(orderId, 'preparing');
} catch (error) {
  // Revert UI update on error
  revertOrderStatusInUI(orderId);
  showError(error);
}
```

### 5. Real-time Updates
Use Socket.IO for real-time updates instead of polling:
```javascript
// BAD: Polling
setInterval(() => {
  fetchActiveOrders();
}, 5000);

// GOOD: Socket.IO
socket.on('order_status_change', (order) => {
  updateOrderInUI(order);
});
```

---

## Version History

### Version 1.0.0 (Current)
- Initial release
- Multi-tenant support with JWT authentication
- Full CRUD operations for orders, menu, categories, tables
- Analytics endpoints
- Kitchen display system
- Bulk operations
- Real-time updates via Socket.IO

---

## Support

For API support, please contact:
- Technical issues: support@example.com
- Documentation questions: docs@example.com

---

**Last Updated:** 2024-01-08
