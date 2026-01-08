# Subscription Management System - API Documentation

## Overview
Complete subscription management system for super-admin to manage restaurant subscriptions, including creation, updates, cancellation, renewal, and payment tracking.

## Base URL
`/api/superadmin/subscriptions`

## Authentication
All endpoints require Super Admin authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <super_admin_token>
```

---

## Endpoints

### 1. Get All Subscriptions
**GET** `/api/superadmin/subscriptions`

Get all subscriptions with pagination, filters, and statistics.

**Query Parameters:**
- `page` (number, optional) - Page number (default: 1)
- `limit` (number, optional) - Items per page (default: 20)
- `status` (string, optional) - Filter by status: 'active' | 'cancelled' | 'expired' | 'pending'
- `billingCycle` (string, optional) - Filter by billing cycle: 'monthly' | 'yearly'
- `autoRenew` (boolean, optional) - Filter by auto-renew status
- `search` (string, optional) - Search in restaurant name, subdomain, or email
- `sortBy` (string, optional) - Sort field (default: 'createdAt')
- `sortOrder` (string, optional) - Sort order: 'asc' | 'desc' (default: 'desc')
- `expiringSoon` (boolean, optional) - Filter expiring subscriptions (within 30 days)

**Response:**
```json
{
  "success": true,
  "data": {
    "subscriptions": [
      {
        "_id": "subscription_id",
        "restaurantId": {
          "_id": "restaurant_id",
          "name": "Restaurant Name",
          "subdomain": "restaurant-subdomain",
          "email": "contact@restaurant.com",
          "phone": "+1234567890",
          "isActive": true
        },
        "planId": {
          "_id": "plan_id",
          "name": "Pro Plan",
          "price": 99.99,
          "features": ["feature1", "feature2"]
        },
        "status": "active",
        "startDate": "2024-01-01T00:00:00.000Z",
        "endDate": "2024-02-01T00:00:00.000Z",
        "renewalDate": "2024-02-01T00:00:00.000Z",
        "amount": 99.99,
        "currency": "USD",
        "billingCycle": "monthly",
        "autoRenew": true,
        "paymentHistory": [],
        "notes": "Optional notes",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "pages": 3
    },
    "statistics": {
      "totalRevenue": 5000.00,
      "activeCount": 35,
      "cancelledCount": 10,
      "expiredCount": 3,
      "pendingCount": 2,
      "monthlyCount": 40,
      "yearlyCount": 10
    }
  }
}
```

---

### 2. Get Subscriptions by Restaurant
**GET** `/api/superadmin/subscriptions/restaurant/:restaurantId`

Get all subscriptions for a specific restaurant.

**Path Parameters:**
- `restaurantId` (string, required) - Restaurant ID

**Response:**
```json
{
  "success": true,
  "data": {
    "restaurant": {
      "_id": "restaurant_id",
      "name": "Restaurant Name",
      "subdomain": "restaurant-subdomain",
      "email": "contact@restaurant.com"
    },
    "subscriptions": [],
    "activeSubscription": {},
    "totalRevenue": 1200.00,
    "count": 5
  }
}
```

---

### 3. Get Subscription by ID
**GET** `/api/superadmin/subscriptions/:id`

Get subscription by ID with detailed statistics.

**Path Parameters:**
- `id` (string, required) - Subscription ID

**Response:**
```json
{
  "success": true,
  "data": {
    "subscription": {},
    "statistics": {
      "totalRevenue": 500.00,
      "totalPayments": 5,
      "successfulPayments": 4,
      "failedPayments": 1,
      "daysUntilExpiry": 25,
      "isExpiringSoon": false,
      "isExpired": false
    }
  }
}
```

---

### 4. Create Subscription
**POST** `/api/superadmin/subscriptions`

Create a new subscription for a restaurant.

**Request Body:**
```json
{
  "restaurantId": "restaurant_id",
  "planId": "plan_id",
  "status": "pending",
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-02-01T00:00:00.000Z",
  "amount": 99.99,
  "currency": "USD",
  "billingCycle": "monthly",
  "autoRenew": true,
  "notes": "Optional notes"
}
```

**Required Fields:**
- `restaurantId` - Restaurant ID
- `amount` - Subscription amount
- `billingCycle` - 'monthly' or 'yearly'
- `endDate` - Subscription end date

**Response:**
```json
{
  "success": true,
  "data": {},
  "message": "Subscription created successfully"
}
```

---

### 5. Update Subscription
**PUT** `/api/superadmin/subscriptions/:id`

Update an existing subscription.

**Path Parameters:**
- `id` (string, required) - Subscription ID

**Request Body:**
```json
{
  "planId": "new_plan_id",
  "status": "active",
  "endDate": "2024-03-01T00:00:00.000Z",
  "renewalDate": "2024-03-01T00:00:00.000Z",
  "amount": 149.99,
  "currency": "USD",
  "billingCycle": "monthly",
  "autoRenew": true,
  "notes": "Updated notes",
  "paymentRecord": {
    "transactionId": "txn_12345",
    "amount": 99.99,
    "currency": "USD",
    "paymentMethod": "credit_card",
    "status": "completed",
    "paymentDate": "2024-01-01T00:00:00.000Z",
    "description": "Monthly subscription payment",
    "metadata": {}
  }
}
```

**All fields are optional.**

**Response:**
```json
{
  "success": true,
  "data": {},
  "message": "Subscription updated successfully"
}
```

---

### 6. Cancel Subscription
**PATCH** `/api/superadmin/subscriptions/:id/cancel`

Cancel a subscription.

**Path Parameters:**
- `id` (string, required) - Subscription ID

**Request Body:**
```json
{
  "cancellationReason": "Customer requested cancellation",
  "immediateTermination": false
}
```

**Fields:**
- `cancellationReason` (string, optional) - Reason for cancellation
- `immediateTermination` (boolean, optional) - If true, terminates immediately. If false, cancels at end of billing period (default: false)

**Response:**
```json
{
  "success": true,
  "data": {},
  "message": "Subscription will be cancelled at the end of the billing period"
}
```

---

### 7. Renew Subscription
**POST** `/api/superadmin/subscriptions/:id/renew`

Renew a subscription.

**Path Parameters:**
- `id` (string, required) - Subscription ID

**Request Body:**
```json
{
  "amount": 99.99,
  "billingCycle": "monthly",
  "extensionMonths": 1,
  "paymentRecord": {
    "transactionId": "txn_12345",
    "amount": 99.99,
    "currency": "USD",
    "paymentMethod": "credit_card",
    "status": "completed",
    "paymentDate": "2024-02-01T00:00:00.000Z",
    "description": "Subscription renewal - monthly"
  }
}
```

**All fields are optional.**
- `amount` - New subscription amount (optional, uses existing if not provided)
- `billingCycle` - New billing cycle (optional, uses existing if not provided)
- `extensionMonths` - Number of months to extend (optional, defaults based on billing cycle)
- `paymentRecord` - Payment information for the renewal (optional)

**Response:**
```json
{
  "success": true,
  "data": {},
  "message": "Subscription renewed successfully"
}
```

---

### 8. Delete Subscription
**DELETE** `/api/superadmin/subscriptions/:id`

Delete a subscription (only non-active subscriptions can be deleted).

**Path Parameters:**
- `id` (string, required) - Subscription ID

**Response:**
```json
{
  "success": true,
  "message": "Subscription deleted successfully"
}
```

---

## Payment Record Structure

When adding payment records via update or renew endpoints:

```json
{
  "transactionId": "txn_12345",
  "amount": 99.99,
  "currency": "USD",
  "paymentMethod": "credit_card",
  "status": "completed",
  "paymentDate": "2024-01-01T00:00:00.000Z",
  "description": "Payment description",
  "metadata": {
    "key": "value"
  }
}
```

**Payment Methods:**
- `credit_card`
- `debit_card`
- `paypal`
- `bank_transfer`
- `other`

**Payment Status:**
- `pending`
- `completed`
- `failed`
- `refunded`

---

## Error Responses

All endpoints return error responses in the following format:

```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error (in development mode)"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Files Created

### 1. Subscription Model
**Location:** `/Users/yaswanthgandhi/Documents/patlinks/packages/backend/src/models/Subscription.ts`

**Features:**
- Full TypeScript interfaces for ISubscription and IPaymentRecord
- Mongoose schemas with validation
- Indexes for performance optimization
- Instance methods: `isValid()`, `isExpiringSoon()`, `addPayment()`, `getLastPayment()`, `getTotalRevenue()`
- Static methods: `findActiveSubscriptions()`, `findExpiringSubscriptions()`, `findExpiredSubscriptions()`
- Pre-save hooks for automatic renewal date calculation

### 2. Subscription Controller
**Location:** `/Users/yaswanthgandhi/Documents/patlinks/packages/backend/src/controllers/subscriptionController.ts`

**Functions:**
- `getAllSubscriptions` - List all with filters and statistics
- `getSubscriptionsByRestaurant` - Get all for specific restaurant
- `getSubscriptionById` - Get detailed subscription info
- `createSubscription` - Create new subscription
- `updateSubscription` - Update existing subscription
- `cancelSubscription` - Cancel subscription
- `renewSubscription` - Renew subscription
- `deleteSubscription` - Delete non-active subscription

### 3. Subscription Routes
**Location:** `/Users/yaswanthgandhi/Documents/patlinks/packages/backend/src/routes/subscriptionRoutes.ts`

**Routes:**
- All routes use `superAdminAuth` middleware
- RESTful API design
- Comprehensive route documentation

### 4. Server Configuration
**Location:** `/Users/yaswanthgandhi/Documents/patlinks/packages/backend/src/server.ts`

**Changes:**
- Imported subscription routes
- Mounted at `/api/superadmin/subscriptions`
- Added to API documentation endpoint
- Added to features list

---

## Usage Examples

### Create a Monthly Subscription
```bash
curl -X POST http://localhost:5000/api/superadmin/subscriptions \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "restaurant_id",
    "amount": 99.99,
    "billingCycle": "monthly",
    "endDate": "2024-02-01T00:00:00.000Z",
    "autoRenew": true
  }'
```

### Get All Active Subscriptions
```bash
curl -X GET "http://localhost:5000/api/superadmin/subscriptions?status=active&page=1&limit=20" \
  -H "Authorization: Bearer <super_admin_token>"
```

### Renew Subscription with Payment
```bash
curl -X POST http://localhost:5000/api/superadmin/subscriptions/<subscription_id>/renew \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentRecord": {
      "transactionId": "txn_12345",
      "amount": 99.99,
      "paymentMethod": "credit_card",
      "status": "completed"
    }
  }'
```

### Cancel Subscription Immediately
```bash
curl -X PATCH http://localhost:5000/api/superadmin/subscriptions/<subscription_id>/cancel \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "cancellationReason": "Customer request",
    "immediateTermination": true
  }'
```

---

## Notes

- All subscriptions are tied to restaurants via `restaurantId`
- Payment history is stored within each subscription
- Auto-renewal is managed via the `autoRenew` flag and `renewalDate`
- Subscriptions can be filtered, searched, and sorted with various parameters
- Statistics are automatically calculated for revenue, counts, and expiry tracking
- Only non-active subscriptions can be deleted (active ones must be cancelled first)
