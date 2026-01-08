# Patlinks Food Ordering API Documentation
## Multi-Tenant SaaS Platform - Version 3.0

This document provides comprehensive API documentation for the Patlinks Food Ordering System backend.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Authentication](#authentication)
3. [Super Admin APIs](#super-admin-apis)
4. [Restaurant Admin APIs](#restaurant-admin-apis)
5. [User (Customer) APIs](#user-customer-apis)
6. [WebSocket Events](#websocket-events)
7. [Error Handling](#error-handling)

---

## Architecture Overview

### Multi-Tenant Design
- **Subdomain-based isolation**: Each restaurant has a unique subdomain (e.g., `pizzahut.patlinks.com`)
- **Data segregation**: All queries include `restaurantId` to prevent cross-tenant data access
- **Namespace isolation**: Socket.io uses per-restaurant namespaces (`/restaurant/{restaurantId}`)

### Base URLs
- **Super Admin API**: `http://localhost:5000/api/super-admin`
- **Restaurant APIs**: `http://[subdomain].localhost:5000/api`
- **Development**: Use `x-restaurant-id` header to bypass subdomain requirement

### Authentication
- **JWT-based**: Tokens contain `id`, `restaurantId`, and `type`
- **Token Types**:
  - `admin`: Restaurant administrators
  - `super_admin`: Platform administrators
  - `customer`: Table-based customers (for Socket.io)

---

## Authentication

### Admin Login (Tenant-Scoped)
Authenticate a restaurant admin.

**Endpoint**: `POST /api/auth/login`

**Headers**:
```
Content-Type: application/json
Host: pizzahut.localhost:5000 (or use x-restaurant-id header)
```

**Request Body**:
```json
{
  "username": "pizzahut_admin",
  "password": "Pizza@123"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "admin": {
      "_id": "...",
      "username": "pizzahut_admin",
      "email": "admin@pizzahut.com",
      "role": "admin",
      "restaurantId": "..."
    },
    "restaurant": {
      "_id": "...",
      "name": "Pizza Hut Demo",
      "subdomain": "pizzahut",
      "branding": {...}
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Get Current User
Get authenticated admin details.

**Endpoint**: `GET /api/auth/me`

**Headers**:
```
Authorization: Bearer {token}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "admin": {...},
    "restaurant": {...}
  }
}
```

### Refresh Token
Refresh an expired access token.

**Endpoint**: `POST /api/auth/refresh`

**Request Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## Super Admin APIs

All super admin endpoints require `Authorization: Bearer {superAdminToken}`.

### 1. Super Admin Login

**Endpoint**: `POST /api/super-admin/auth/login`

**Request Body**:
```json
{
  "username": "superadmin",
  "password": "SuperAdmin@123"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "superAdmin": {
      "_id": "...",
      "username": "superadmin",
      "email": "admin@patlinks.com",
      "role": "super_admin"
    },
    "token": "..."
  }
}
```

### 2. Get All Restaurants

**Endpoint**: `GET /api/super-admin/restaurants`

**Query Parameters**:
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `search` (string): Search by name, subdomain, or email
- `status` (string): Filter by active/inactive
- `subscriptionStatus` (string): Filter by subscription status
- `plan` (string): Filter by subscription plan
- `sortBy` (string): Sort field (default: createdAt)
- `sortOrder` (string): asc/desc (default: desc)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "restaurants": [
      {
        "_id": "...",
        "name": "Pizza Hut Demo",
        "subdomain": "pizzahut",
        "email": "contact@pizzahut-demo.com",
        "subscription": {
          "plan": "pro",
          "status": "active"
        },
        "stats": {
          "adminCount": 2,
          "orderCount": 150,
          "menuItemCount": 45
        }
      }
    ],
    "pagination": {
      "total": 10,
      "page": 1,
      "limit": 20,
      "pages": 1
    }
  }
}
```

### 3. Create Restaurant

**Endpoint**: `POST /api/super-admin/restaurants`

**Request Body**:
```json
{
  "subdomain": "newrestaurant",
  "name": "New Restaurant",
  "email": "contact@newrestaurant.com",
  "phone": "+1-555-0100",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "US"
  },
  "branding": {
    "primaryColor": "#FF0000",
    "secondaryColor": "#FFFFFF",
    "accentColor": "#FFD700"
  },
  "subscription": {
    "plan": "basic",
    "maxTables": 30,
    "maxMenuItems": 100,
    "maxAdmins": 5
  }
}
```

### 4. Get Restaurant by ID

**Endpoint**: `GET /api/super-admin/restaurants/:id`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "restaurant": {...},
    "stats": {
      "adminCount": 2,
      "orderCount": 150,
      "menuItemCount": 45,
      "categoryCount": 7,
      "tableCount": 15,
      "totalRevenue": 15000.50,
      "averageOrderValue": 100.00
    },
    "recentOrders": [...],
    "admins": [...]
  }
}
```

### 5. Update Restaurant

**Endpoint**: `PUT /api/super-admin/restaurants/:id`

**Request Body**: Partial restaurant object

### 6. Toggle Restaurant Status

**Endpoint**: `PATCH /api/super-admin/restaurants/:id/status`

**Request Body**:
```json
{
  "isActive": false
}
```

### 7. Delete Restaurant

**Endpoint**: `DELETE /api/super-admin/restaurants/:id`

**Note**: This performs cascade delete of all restaurant data (admins, menu, tables, orders).

### 8. Create Restaurant Admin

**Endpoint**: `POST /api/super-admin/restaurants/:restaurantId/admins`

**Request Body**:
```json
{
  "username": "newadmin",
  "email": "admin@restaurant.com",
  "password": "Secure@123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "admin"
}
```

### 9. Get Restaurant Admins

**Endpoint**: `GET /api/super-admin/restaurants/:restaurantId/admins`

### 10. Get Global Analytics

**Endpoint**: `GET /api/super-admin/analytics/global`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalRestaurants": 25,
      "activeRestaurants": 22,
      "totalAdmins": 65,
      "totalOrders": 5000,
      "totalMenuItems": 1200,
      "totalRevenue": 250000,
      "averageOrderValue": 50.00
    },
    "restaurantsByPlan": {
      "trial": 5,
      "basic": 10,
      "pro": 8,
      "enterprise": 2
    },
    "ordersByStatus": {...},
    "recentRestaurants": [...]
  }
}
```

---

## Restaurant Admin APIs

All restaurant admin endpoints require tenant context (subdomain or x-restaurant-id header) and `Authorization: Bearer {token}`.

### Categories

#### 1. Get All Categories
**Endpoint**: `GET /api/categories`

**Query Parameters**:
- `includeInactive` (boolean): Include inactive categories

#### 2. Get Category by ID
**Endpoint**: `GET /api/categories/:id`

#### 3. Create Category
**Endpoint**: `POST /api/categories`

**Request Body**:
```json
{
  "name": "Appetizers",
  "description": "Start your meal right",
  "displayOrder": 1,
  "isActive": true
}
```

#### 4. Update Category
**Endpoint**: `PUT /api/categories/:id`

#### 5. Delete Category
**Endpoint**: `DELETE /api/categories/:id`

#### 6. Toggle Category Status
**Endpoint**: `PATCH /api/categories/:id/toggle`

---

### Menu Items

#### 1. Get All Menu Items
**Endpoint**: `GET /api/menu`

**Query Parameters**:
- `category` (string): Filter by category ID
- `available` (boolean): Filter by availability
- `dietary` (string): Filter by dietary options (vegetarian, vegan, glutenFree)

#### 2. Get Menu Item by ID
**Endpoint**: `GET /api/menu/:id`

#### 3. Create Menu Item
**Endpoint**: `POST /api/menu`

**Request Body**:
```json
{
  "name": "Margherita Pizza",
  "description": "Classic pizza with fresh mozzarella",
  "categoryId": "...",
  "price": 12.99,
  "image": "",
  "isAvailable": true,
  "isVegetarian": true,
  "isVegan": false,
  "isGlutenFree": false,
  "preparationTime": 20,
  "customizationOptions": [
    {
      "name": "Size",
      "type": "single",
      "required": true,
      "options": [
        { "label": "Small", "priceModifier": 0 },
        { "label": "Medium", "priceModifier": 3 },
        { "label": "Large", "priceModifier": 6 }
      ]
    }
  ]
}
```

#### 4. Update Menu Item
**Endpoint**: `PUT /api/menu/:id`

#### 5. Delete Menu Item
**Endpoint**: `DELETE /api/menu/:id`

#### 6. Toggle Menu Item Availability
**Endpoint**: `PATCH /api/menu/:id/toggle`

---

### Tables

#### 1. Get All Tables
**Endpoint**: `GET /api/tables`

#### 2. Get Table by ID
**Endpoint**: `GET /api/tables/:id`

#### 3. Create Table
**Endpoint**: `POST /api/tables`

**Request Body**:
```json
{
  "tableNumber": "10",
  "capacity": 4,
  "location": "Window Side",
  "isActive": true
}
```

#### 4. Update Table
**Endpoint**: `PUT /api/tables/:id`

#### 5. Delete Table
**Endpoint**: `DELETE /api/tables/:id`

#### 6. Get Table Status
**Endpoint**: `GET /api/tables/:id/status`

---

### Orders

#### 1. Get All Orders
**Endpoint**: `GET /api/orders`

**Query Parameters**:
- `status` (string): Filter by status (received, preparing, ready, served, cancelled)
- `tableId` (string): Filter by table
- `startDate` (string): Filter by date range
- `endDate` (string): Filter by date range
- `page` (number): Pagination
- `limit` (number): Items per page

#### 2. Get Order by ID
**Endpoint**: `GET /api/orders/:id`

#### 3. Create Order
**Endpoint**: `POST /api/orders`

**Request Body**:
```json
{
  "tableId": "...",
  "items": [
    {
      "menuItemId": "...",
      "name": "Margherita Pizza",
      "quantity": 2,
      "price": 12.99,
      "customizations": [
        {
          "optionName": "Size",
          "selectedValue": "Large",
          "priceModifier": 6
        }
      ],
      "specialInstructions": "No onions"
    }
  ],
  "notes": "Extra napkins please"
}
```

#### 4. Update Order Status
**Endpoint**: `PATCH /api/orders/:id/status`

**Request Body**:
```json
{
  "status": "preparing"
}
```

#### 5. Cancel Order
**Endpoint**: `PATCH /api/orders/:id/cancel`

#### 6. Add Items to Order
**Endpoint**: `POST /api/orders/:id/items`

#### 7. Remove Item from Order
**Endpoint**: `DELETE /api/orders/:id/items/:itemIndex`

#### 8. Update Item Quantity
**Endpoint**: `PATCH /api/orders/:id/items/:itemIndex/quantity`

---

### Kitchen Display

#### 1. Get Kitchen Orders
**Endpoint**: `GET /api/kitchen/orders`

**Response**: Returns orders grouped by status (received, preparing)

#### 2. Start Order (received → preparing)
**Endpoint**: `PATCH /api/kitchen/orders/:id/start`

#### 3. Mark Order Ready (preparing → ready)
**Endpoint**: `PATCH /api/kitchen/orders/:id/ready`

#### 4. Get Kitchen Stats
**Endpoint**: `GET /api/kitchen/stats`

---

### Analytics

#### 1. Get Revenue Analytics
**Endpoint**: `GET /api/analytics/revenue`

**Query Parameters**:
- `period` (string): today, week, month, custom
- `startDate` (string): For custom period
- `endDate` (string): For custom period

#### 2. Get Popular Items
**Endpoint**: `GET /api/analytics/popular-items`

**Query Parameters**:
- `limit` (number): Number of items (default: 10)
- `period` (string): today, week, month

#### 3. Get Category Performance
**Endpoint**: `GET /api/analytics/category-performance`

#### 4. Get Peak Hours
**Endpoint**: `GET /api/analytics/peak-hours`

#### 5. Get Table Performance
**Endpoint**: `GET /api/analytics/table-performance`

#### 6. Get Preparation Time
**Endpoint**: `GET /api/analytics/preparation-time`

#### 7. Get Dashboard Analytics
**Endpoint**: `GET /api/analytics/dashboard`

---

### Search

#### 1. Search Menu Items
**Endpoint**: `GET /api/search/menu`

**Query Parameters**:
- `q` (string): Search query (min 2 characters)
- `category` (string): Filter by category
- `dietary` (string): Filter by dietary options
- `minPrice` (number): Min price
- `maxPrice` (number): Max price
- `available` (boolean): Only available items

#### 2. Search Orders
**Endpoint**: `GET /api/search/orders`

**Query Parameters**:
- `q` (string): Search by order number, table, notes
- `status` (string): Filter by status
- `startDate` (string): Date range
- `endDate` (string): Date range

#### 3. Filter Menu Items
**Endpoint**: `GET /api/search/menu/filter`

---

### Bulk Operations

#### 1. Bulk Update Availability
**Endpoint**: `PATCH /api/bulk/menu/availability`

**Request Body**:
```json
{
  "itemIds": ["id1", "id2", "id3"],
  "isAvailable": false
}
```

#### 2. Bulk Update Prices
**Endpoint**: `PATCH /api/bulk/menu/prices`

**Request Body**:
```json
{
  "updates": [
    { "itemId": "id1", "price": 14.99 },
    { "itemId": "id2", "price": 16.99 }
  ]
}
```

#### 3. Bulk Update Category
**Endpoint**: `PATCH /api/bulk/menu/category`

#### 4. Bulk Delete Menu Items
**Endpoint**: `DELETE /api/bulk/menu`

#### 5. Bulk Update Table Status
**Endpoint**: `PATCH /api/bulk/tables/status`

#### 6. Export Orders
**Endpoint**: `POST /api/bulk/orders/export`

**Request Body**:
```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "status": "served"
}
```

#### 7. Get Bulk Summary
**Endpoint**: `GET /api/bulk/summary`

---

## User (Customer) APIs

These endpoints are public and don't require authentication. They require tenant context.

### Get Restaurant Info
**Endpoint**: `GET /api/restaurant/info` (if implemented)

### Get Menu
**Endpoint**: `GET /api/menu`

### Get Categories
**Endpoint**: `GET /api/categories`

### Create Order (Customer)
**Endpoint**: `POST /api/orders`

---

## WebSocket Events

### Connection
Connect to restaurant-specific namespace:

```javascript
const socket = io('http://localhost:5000/restaurant/{restaurantId}', {
  auth: {
    token: customerToken // or adminToken
  }
});
```

### Admin Events

#### Join Admin Room
```javascript
socket.emit('join-admin');

socket.on('admin-joined', (data) => {
  console.log('Joined admin room');
});
```

#### Listen for New Orders
```javascript
socket.on('new-order', (orderData) => {
  console.log('New order received:', orderData);
});
```

#### Listen for Order Status Changes
```javascript
socket.on('order-status-changed', (data) => {
  console.log('Order status changed:', data);
});
```

#### Listen for Active Orders Update
```javascript
socket.on('active-orders-updated', (data) => {
  console.log('Active orders:', data.orders);
});
```

### Customer Events

#### Join Table Room
```javascript
socket.emit('join-table', { tableNumber: '5' });

socket.on('table-joined', (data) => {
  console.log('Joined table:', data.tableNumber);
});
```

#### Track Order
```javascript
socket.emit('track-order', { orderId: '...' });

socket.on('order-updated', (data) => {
  console.log('Order update:', data.order);
});
```

#### Listen for Status Updates
```javascript
socket.on('order-status-updated', (data) => {
  console.log('Your order is now:', data.status);
});
```

---

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "error": "Detailed error message (dev only)"
}
```

### Common Error Codes
- `NO_TOKEN`: No authentication token provided
- `INVALID_TOKEN`: Token is invalid or malformed
- `TOKEN_EXPIRED`: Token has expired
- `RESTAURANT_MISMATCH`: Token restaurant doesn't match request context
- `ACCOUNT_INACTIVE`: User account is inactive
- `SUPER_ADMIN_REQUIRED`: Endpoint requires super admin access
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions

### HTTP Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

---

## Development Tips

### Using Postman/Thunder Client

1. **Set Base URL Variable**:
   - `{{baseUrl}}` = `http://localhost:5000`

2. **For Tenant APIs**:
   - Add header: `x-restaurant-id: {restaurantId}`
   - OR use subdomain: `http://pizzahut.localhost:5000`

3. **Authentication**:
   - Login to get token
   - Add to all requests: `Authorization: Bearer {token}`

### Testing Multi-Tenant Isolation

Run the isolation test script:
```bash
npm run test:isolation
```

### Seeding Demo Data

Create 3 demo restaurants with full data:
```bash
npm run seed:multi
```

### Creating Super Admin

Interactive script to create super admin:
```bash
npm run create:superadmin
```

---

## API Versioning

Current version: **v3.0** (Multi-Tenant)

Major changes from v2.0:
- Added multi-tenant architecture
- Added restaurantId to all queries
- Added subdomain-based routing
- Added super admin APIs
- Added namespace-based Socket.io

---

## Rate Limiting

- **API Endpoints**: 100 requests per 15 minutes per IP
- **Login Endpoint**: 5 attempts per 15 minutes per IP

---

## Support

For issues or questions:
- GitHub: https://github.com/yourusername/patlinks
- Email: support@patlinks.com

---

**Last Updated**: 2024-01-08
**Version**: 3.0.0
