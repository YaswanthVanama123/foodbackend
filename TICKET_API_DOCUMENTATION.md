# Support Ticket Management System - API Documentation

## Overview
The support ticket management system provides a comprehensive solution for handling customer support requests, technical issues, billing inquiries, and feature requests from restaurants using the platform.

## Base URL
All ticket endpoints are accessible at: `/api/superadmin/tickets`

## Features
- Auto-generated unique ticket numbers (TKT-XXXXXX)
- Multi-category support (technical, billing, feature_request, other)
- Priority levels (low, medium, high, critical)
- Status tracking (open, in_progress, resolved, closed)
- Assignment to super admins
- Message threads with attachments
- Tagging system
- Advanced filtering and search
- Comprehensive statistics

---

## Endpoints

### 1. Get All Tickets
**GET** `/api/superadmin/tickets`

Retrieve all tickets with advanced filtering, search, and pagination.

**Query Parameters:**
- `status` (string, optional): Filter by status (open, in_progress, resolved, closed)
- `priority` (string, optional): Filter by priority (low, medium, high, critical)
- `category` (string, optional): Filter by category (technical, billing, feature_request, other)
- `restaurantId` (string, optional): Filter by restaurant ID
- `assignedTo` (string, optional): Filter by assigned super admin ID or "unassigned"
- `tags` (string, optional): Comma-separated list of tags
- `search` (string, optional): Search in ticket number, title, description, or restaurant name
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)
- `sortBy` (string, optional): Field to sort by (default: createdAt)
- `sortOrder` (string, optional): Sort order - "asc" or "desc" (default: desc)

**Example Request:**
```bash
GET /api/superadmin/tickets?status=open&priority=high&page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "message": "Tickets retrieved successfully",
  "data": {
    "tickets": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalTickets": 50,
      "limit": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    },
    "statistics": {
      "byStatus": {
        "open": 15,
        "in_progress": 10,
        "resolved": 20,
        "closed": 5
      },
      "byPriority": {
        "low": 10,
        "medium": 20,
        "high": 15,
        "critical": 5
      }
    }
  }
}
```

---

### 2. Get Ticket by ID
**GET** `/api/superadmin/tickets/:id`

Retrieve detailed information about a specific ticket, including all messages.

**URL Parameters:**
- `id` (string, required): Ticket ObjectId

**Example Request:**
```bash
GET /api/superadmin/tickets/507f1f77bcf86cd799439011
```

**Response:**
```json
{
  "success": true,
  "message": "Ticket retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "ticketNumber": "TKT-000001",
    "restaurantId": {...},
    "restaurantName": "Restaurant ABC",
    "title": "Payment gateway not working",
    "description": "Unable to process payments...",
    "category": "technical",
    "priority": "high",
    "status": "in_progress",
    "assignedTo": {...},
    "messages": [...],
    "tags": ["payment", "urgent"],
    "createdAt": "2024-01-08T10:00:00Z",
    "updatedAt": "2024-01-08T12:00:00Z"
  }
}
```

---

### 3. Create Ticket
**POST** `/api/superadmin/tickets`

Create a new support ticket.

**Request Body:**
```json
{
  "restaurantId": "507f1f77bcf86cd799439011",  // optional
  "restaurantName": "Restaurant ABC",
  "title": "Payment gateway not working",
  "description": "Detailed description of the issue...",
  "category": "technical",
  "priority": "high",
  "tags": ["payment", "urgent"]
}
```

**Required Fields:**
- `restaurantName` (string)
- `title` (string, min: 5 chars, max: 200 chars)
- `description` (string, min: 10 chars, max: 2000 chars)
- `category` (string: technical | billing | feature_request | other)

**Optional Fields:**
- `restaurantId` (string: valid ObjectId)
- `priority` (string: low | medium | high | critical, default: medium)
- `tags` (array of strings, max: 10 tags)

**Response:**
```json
{
  "success": true,
  "message": "Ticket created successfully",
  "data": {
    "ticketNumber": "TKT-000001",
    ...
  }
}
```

---

### 4. Update Ticket
**PUT** `/api/superadmin/tickets/:id`

Update ticket details (title, description, category, priority, tags).

**URL Parameters:**
- `id` (string, required): Ticket ObjectId

**Request Body:**
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "category": "billing",
  "priority": "critical",
  "tags": ["urgent", "payment"]
}
```

**Note:** All fields are optional. Only provided fields will be updated.

**Response:**
```json
{
  "success": true,
  "message": "Ticket updated successfully",
  "data": {...}
}
```

---

### 5. Add Message to Ticket
**POST** `/api/superadmin/tickets/:id/messages`

Add a new message to a ticket's conversation thread.

**URL Parameters:**
- `id` (string, required): Ticket ObjectId

**Request Body:**
```json
{
  "sender": "super_admin",
  "senderName": "John Doe",
  "senderId": "507f1f77bcf86cd799439012",
  "message": "We are working on this issue...",
  "attachments": ["https://example.com/file.png"],
  "isInternal": false
}
```

**Required Fields:**
- `sender` (string: restaurant | super_admin | system)
- `senderName` (string)
- `message` (string, max: 2000 chars)

**Optional Fields:**
- `senderId` (string: valid ObjectId)
- `attachments` (array of strings: URLs)
- `isInternal` (boolean, default: false) - Internal notes visible only to super admins

**Response:**
```json
{
  "success": true,
  "message": "Message added successfully",
  "data": {...}
}
```

---

### 6. Assign Ticket
**PATCH** `/api/superadmin/tickets/:id/assign`

Assign a ticket to a super admin or unassign it.

**URL Parameters:**
- `id` (string, required): Ticket ObjectId

**Request Body:**
```json
{
  "assignedTo": "507f1f77bcf86cd799439012"  // or null to unassign
}
```

**Response:**
```json
{
  "success": true,
  "message": "Ticket assigned successfully",
  "data": {...}
}
```

**Notes:**
- Assigning a ticket automatically changes status from "open" to "in_progress"
- A system message is automatically added to the ticket
- To unassign, send `null` or omit the `assignedTo` field

---

### 7. Update Ticket Status
**PATCH** `/api/superadmin/tickets/:id/status`

Change the status of a ticket.

**URL Parameters:**
- `id` (string, required): Ticket ObjectId

**Request Body:**
```json
{
  "status": "resolved",
  "note": "Issue has been fixed"  // optional
}
```

**Valid Statuses:**
- `open` - Newly created, not yet assigned
- `in_progress` - Assigned and being worked on
- `resolved` - Issue has been resolved
- `closed` - Ticket is closed (final state)

**Response:**
```json
{
  "success": true,
  "message": "Ticket status updated successfully",
  "data": {...}
}
```

**Notes:**
- Changing status to "resolved" automatically sets `resolvedAt` timestamp
- Changing status to "closed" automatically sets `closedAt` timestamp
- A system message documenting the status change is automatically added

---

### 8. Resolve Ticket
**POST** `/api/superadmin/tickets/:id/resolve`

Mark a ticket as resolved (shortcut for status update).

**URL Parameters:**
- `id` (string, required): Ticket ObjectId

**Request Body:**
```json
{
  "resolutionNote": "Fixed by updating payment gateway configuration"
}
```

**Optional Fields:**
- `resolutionNote` (string) - Note explaining the resolution

**Response:**
```json
{
  "success": true,
  "message": "Ticket resolved successfully",
  "data": {...}
}
```

---

### 9. Get Ticket Statistics
**GET** `/api/superadmin/tickets/stats`

Get comprehensive statistics about tickets.

**Query Parameters:**
- `restaurantId` (string, optional): Filter by restaurant
- `startDate` (string, optional): Start date for date range (ISO format)
- `endDate` (string, optional): End date for date range (ISO format)

**Example Request:**
```bash
GET /api/superadmin/tickets/stats?startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "success": true,
  "message": "Statistics retrieved successfully",
  "data": {
    "overview": [{
      "total": 100,
      "open": 20,
      "inProgress": 30,
      "resolved": 40,
      "closed": 10
    }],
    "byPriority": [
      { "_id": "high", "count": 25 },
      { "_id": "medium", "count": 50 }
    ],
    "byCategory": [
      { "_id": "technical", "count": 60 },
      { "_id": "billing", "count": 40 }
    ],
    "byRestaurant": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "restaurantName": "Restaurant ABC",
        "count": 15
      }
    ],
    "recentActivity": [...]
  }
}
```

---

### 10. Delete Ticket
**DELETE** `/api/superadmin/tickets/:id`

Permanently delete a ticket (use with caution).

**URL Parameters:**
- `id` (string, required): Ticket ObjectId

**Example Request:**
```bash
DELETE /api/superadmin/tickets/507f1f77bcf86cd799439011
```

**Response:**
```json
{
  "success": true,
  "message": "Ticket deleted successfully",
  "data": {
    "ticketNumber": "TKT-000001"
  }
}
```

---

## Data Models

### Ticket Schema
```typescript
{
  ticketNumber: string,          // Auto-generated (TKT-XXXXXX)
  restaurantId?: ObjectId,       // Optional - can be platform issue
  restaurantName: string,
  title: string,                 // 5-200 chars
  description: string,           // 10-2000 chars
  category: 'technical' | 'billing' | 'feature_request' | 'other',
  priority: 'low' | 'medium' | 'high' | 'critical',
  status: 'open' | 'in_progress' | 'resolved' | 'closed',
  assignedTo?: ObjectId,         // SuperAdmin reference
  assignedToName?: string,
  messages: [Message],
  tags: string[],                // Max 10 tags
  resolvedAt?: Date,
  closedAt?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Message Schema
```typescript
{
  sender: 'restaurant' | 'super_admin' | 'system',
  senderName: string,
  senderId?: ObjectId,
  message: string,               // Max 2000 chars
  timestamp: Date,
  attachments?: string[],        // URLs
  isInternal?: boolean          // Internal notes for super admins
}
```

---

## Common Use Cases

### 1. Restaurant Creates a Support Ticket
```bash
POST /api/superadmin/tickets
Content-Type: application/json

{
  "restaurantId": "507f1f77bcf86cd799439011",
  "restaurantName": "Joe's Pizza",
  "title": "Cannot access payment settings",
  "description": "Getting 404 error when trying to access payment configuration page",
  "category": "technical",
  "priority": "high",
  "tags": ["payment", "access-issue"]
}
```

### 2. Super Admin Reviews Open Tickets
```bash
GET /api/superadmin/tickets?status=open&sortBy=priority&sortOrder=desc
```

### 3. Super Admin Assigns Ticket and Responds
```bash
# Assign ticket
PATCH /api/superadmin/tickets/507f1f77bcf86cd799439011/assign
{
  "assignedTo": "507f1f77bcf86cd799439012"
}

# Add response message
POST /api/superadmin/tickets/507f1f77bcf86cd799439011/messages
{
  "sender": "super_admin",
  "senderName": "John Smith",
  "senderId": "507f1f77bcf86cd799439012",
  "message": "I'm looking into this issue. Can you provide your browser details?"
}
```

### 4. Resolve Ticket
```bash
POST /api/superadmin/tickets/507f1f77bcf86cd799439011/resolve
{
  "resolutionNote": "Fixed permissions issue. Payment settings are now accessible."
}
```

### 5. Get Dashboard Statistics
```bash
GET /api/superadmin/tickets/stats
```

---

## Error Responses

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created successfully
- `400` - Bad request (validation error)
- `404` - Resource not found
- `500` - Internal server error

---

## Best Practices

1. **Auto-assign High Priority Tickets**: Implement logic to automatically assign critical/high priority tickets
2. **Email Notifications**: Integrate email notifications when tickets are created/updated
3. **Response Time Tracking**: Monitor average response times using the built-in methods
4. **Tagging Strategy**: Use consistent tags for better filtering and analytics
5. **Internal Notes**: Use `isInternal: true` for messages that should only be visible to super admins
6. **Regular Status Updates**: Update ticket status as work progresses
7. **Resolution Notes**: Always provide a resolution note when closing tickets

---

## Ticket Lifecycle

```
1. Created → status: "open"
2. Assigned → status: "in_progress" (automatic)
3. Work in Progress → messages exchanged
4. Resolved → status: "resolved" + resolvedAt timestamp
5. Closed → status: "closed" + closedAt timestamp (final state)
```

---

## Advanced Features

### Filtering Examples

**Get unassigned high priority tickets:**
```bash
GET /api/superadmin/tickets?assignedTo=unassigned&priority=high
```

**Get tickets for a specific restaurant:**
```bash
GET /api/superadmin/tickets?restaurantId=507f1f77bcf86cd799439011
```

**Search tickets:**
```bash
GET /api/superadmin/tickets?search=payment%20gateway
```

**Get tickets with specific tags:**
```bash
GET /api/superadmin/tickets?tags=urgent,payment
```

---

## Integration Notes

- All ticket routes are under `/api/superadmin/tickets`
- No tenant middleware is applied (super admin level access)
- Ticket numbers are auto-generated and guaranteed unique
- All dates are returned in ISO 8601 format
- Population is automatically handled for `restaurantId` and `assignedTo` references
- Comprehensive indexing ensures fast queries even with large datasets

---

## Future Enhancements

Consider implementing:
- Email notifications for ticket events
- SLA tracking and alerts
- Ticket priority escalation rules
- Attachment upload support
- Ticket templates
- Customer satisfaction ratings
- Integration with external support tools (Zendesk, Intercom, etc.)
