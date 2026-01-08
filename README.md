# Patlinks Backend API
## Multi-Tenant SaaS Food Ordering Platform - v3.0

Complete backend system for the Patlinks food ordering platform with multi-tenant architecture, supporting 3 frontend applications.

---

## 🎯 Overview

Patlinks Backend is a multi-tenant SaaS platform built with Node.js, Express, MongoDB, and Socket.io. It provides complete API infrastructure for:
- **Super Admin App**: Platform management and oversight
- **Restaurant Admin App**: Restaurant-specific management dashboard
- **User (Customer) App**: Customer ordering interface

### Key Features
- ✅ Multi-tenant architecture with subdomain-based isolation
- ✅ Complete data segregation (per restaurant)
- ✅ Real-time updates via Socket.io namespaces
- ✅ JWT authentication with role-based access control
- ✅ Comprehensive analytics and reporting
- ✅ Kitchen display system (KDS)
- ✅ Bulk operations and data export
- ✅ Advanced search and filtering
- ✅ Order management and modifications
- ✅ Menu and catalog management
- ✅ Table management

---

## 📁 Project Structure

```
packages/backend/
├── src/
│   ├── config/          # Configuration files
│   │   ├── database.ts
│   │   ├── jwt.ts
│   │   └── socket.ts
│   ├── controllers/     # Request handlers (11 controllers)
│   │   ├── authController.ts
│   │   ├── superAdminController.ts
│   │   ├── categoryController.ts
│   │   ├── menuController.ts
│   │   ├── tableController.ts
│   │   ├── orderController.ts
│   │   ├── orderModificationController.ts
│   │   ├── kitchenController.ts
│   │   ├── analyticsController.ts
│   │   ├── searchController.ts
│   │   └── bulkController.ts
│   ├── middleware/      # Middleware functions
│   │   ├── authMiddleware.ts
│   │   ├── tenantMiddleware.ts
│   │   ├── errorHandler.ts
│   │   ├── uploadMiddleware.ts
│   │   └── validationMiddleware.ts
│   ├── models/          # MongoDB schemas (7 models)
│   │   ├── SuperAdmin.ts
│   │   ├── Restaurant.ts
│   │   ├── Admin.ts
│   │   ├── Category.ts
│   │   ├── MenuItem.ts
│   │   ├── Table.ts
│   │   └── Order.ts
│   ├── routes/          # API routes (11 route files)
│   │   ├── authRoutes.ts
│   │   ├── superAdminRoutes.ts
│   │   ├── categoryRoutes.ts
│   │   ├── menuRoutes.ts
│   │   ├── tableRoutes.ts
│   │   ├── orderRoutes.ts
│   │   ├── kitchenRoutes.ts
│   │   ├── analyticsRoutes.ts
│   │   ├── searchRoutes.ts
│   │   └── bulkRoutes.ts
│   ├── services/        # Business logic services
│   │   ├── socketService.ts
│   │   └── orderService.ts
│   ├── scripts/         # Utility scripts
│   │   ├── createSuperAdmin.ts
│   │   ├── migrateToMultiTenant.ts
│   │   ├── seedMultiTenant.ts
│   │   └── testDataIsolation.ts
│   ├── types/           # TypeScript definitions
│   │   └── express.d.ts
│   └── server.ts        # Application entry point
├── .env.example         # Environment variables template
├── API_DOCUMENTATION.md # Comprehensive API docs
├── package.json
├── tsconfig.json
└── README.md           # This file
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+
- **MongoDB**: v6+
- **npm**: v9+

### Installation

1. **Install dependencies**:
```bash
cd packages/backend
npm install
```

2. **Environment Setup**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start MongoDB**:
```bash
# Using local MongoDB
mongod

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

4. **Create Super Admin** (First time only):
```bash
npm run create:superadmin
# Follow the interactive prompts
```

5. **Seed Demo Data** (Optional):
```bash
npm run seed:multi
# Creates 3 demo restaurants with full data
```

6. **Start Development Server**:
```bash
npm run dev
```

The server will start at `http://localhost:5000`

---

## 📜 Available Scripts

```bash
# Development
npm run dev              # Start development server with hot reload

# Production
npm run build            # Compile TypeScript to JavaScript
npm run start            # Start production server

# Database
npm run seed             # Seed single restaurant (legacy)
npm run seed:multi       # Seed 3 demo restaurants with full data
npm run migrate          # Migrate single-tenant to multi-tenant

# Admin
npm run create:superadmin  # Interactive super admin creation

# Testing
npm run test:isolation   # Test multi-tenant data isolation
```

---

## 🏗️ Multi-Tenant Architecture

### Subdomain-Based Isolation
Each restaurant operates on a unique subdomain:
- **Pizza Hut**: `pizzahut.localhost:5000`
- **Burger King**: `burgerking.localhost:5000`
- **Taco Bell**: `tacobell.localhost:5000`

### Data Segregation
- All database queries include `restaurantId` filter
- Prevents cross-tenant data access
- Compound unique indexes for tenant-scoped uniqueness

### Socket.io Namespaces
- Each restaurant has isolated namespace: `/restaurant/{restaurantId}`
- Real-time events are tenant-scoped
- Admins only see their restaurant's data

### Authentication
JWT tokens contain:
```json
{
  "id": "userId",
  "restaurantId": "restaurantId",
  "type": "admin|super_admin|customer"
}
```

---

## 🔐 Authentication & Authorization

### Token Types
1. **Admin Token**: Restaurant administrators
   - Contains `restaurantId`
   - Validated against tenant context
   - Access to restaurant-specific APIs

2. **Super Admin Token**: Platform administrators
   - No `restaurantId` (platform-wide access)
   - Access to all restaurants
   - Can create/manage restaurants

3. **Customer Token**: Table-based customers
   - Used for Socket.io connections
   - Limited to specific table/order tracking

### Login Endpoints
```bash
# Restaurant Admin Login
POST /api/auth/login
Headers: Host: pizzahut.localhost:5000

# Super Admin Login
POST /api/super-admin/auth/login
```

---

## 📊 API Endpoints Summary

### Super Admin APIs (Platform Management)
- `POST /api/super-admin/auth/login` - Login
- `GET /api/super-admin/restaurants` - List all restaurants
- `POST /api/super-admin/restaurants` - Create restaurant
- `GET /api/super-admin/restaurants/:id` - Get restaurant details
- `PUT /api/super-admin/restaurants/:id` - Update restaurant
- `DELETE /api/super-admin/restaurants/:id` - Delete restaurant
- `POST /api/super-admin/restaurants/:id/admins` - Create admin
- `GET /api/super-admin/analytics/global` - Global analytics

### Restaurant Admin APIs (Tenant-Scoped)
- **Auth**: Login, logout, refresh, get current user
- **Categories**: CRUD + toggle status
- **Menu Items**: CRUD + toggle availability + customization options
- **Tables**: CRUD + status management
- **Orders**: CRUD + status updates + modifications
- **Kitchen**: Display orders, update status, stats
- **Analytics**: Revenue, popular items, performance metrics
- **Search**: Menu items, orders, advanced filtering
- **Bulk Operations**: Mass updates, exports

### Customer APIs (Public, Tenant-Scoped)
- Get menu
- Get categories
- Create order
- Track order (via Socket.io)

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete API reference.

---

## 🔌 WebSocket Events

### Connection
```javascript
const socket = io('http://localhost:5000/restaurant/{restaurantId}', {
  auth: { token: jwtToken }
});
```

### Admin Events
- `new-order` - New order received
- `order-status-changed` - Order status updated
- `active-orders-updated` - Active orders list updated

### Customer Events
- `join-table` - Join table room
- `order-status-updated` - Order status changed
- `order-updated` - Order details updated

---

## 🗄️ Database Models

### Restaurant
```typescript
{
  subdomain: string,        // Unique subdomain
  name: string,
  branding: {               // Custom branding
    primaryColor, secondaryColor, logo, theme
  },
  subscription: {           // Subscription details
    plan, status, maxTables, maxMenuItems, maxAdmins
  }
}
```

### Admin
```typescript
{
  restaurantId: ObjectId,   // Tenant isolation
  username: string,         // Unique per restaurant
  email: string,
  role: string,
  permissions: string[]
}
```

### MenuItem
```typescript
{
  restaurantId: ObjectId,
  name: string,
  categoryId: ObjectId,
  price: number,
  isVegetarian, isVegan, isGlutenFree,
  customizationOptions: []
}
```

### Order
```typescript
{
  restaurantId: ObjectId,
  orderNumber: string,      // Unique per restaurant
  tableId: ObjectId,
  items: [],
  status: enum,
  statusHistory: []
}
```

---

## 🧪 Testing

### Data Isolation Test
Verify multi-tenant data segregation:
```bash
npm run test:isolation
```

Tests:
- ✅ Admin isolation
- ✅ Category isolation
- ✅ Menu item isolation
- ✅ Table isolation
- ✅ Order isolation
- ✅ Username uniqueness (scoped)
- ✅ Cross-tenant query prevention

### Manual Testing with Postman

1. **Setup**:
   - Import collection (if provided)
   - Set base URL: `http://localhost:5000`
   - Set restaurant header: `x-restaurant-id: {restaurantId}`

2. **Test Flow**:
   - Login as super admin
   - Create 2 restaurants
   - Create admins for each restaurant
   - Login as restaurant1 admin
   - Create menu items
   - Verify restaurant2 admin can't see restaurant1 data

---

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Tenant Validation**: All requests validated against tenant
- **Password Hashing**: bcrypt with salt rounds
- **Rate Limiting**: API and login rate limits
- **CORS Configuration**: Configured origins
- **Helmet**: Security headers
- **MongoDB Sanitization**: Prevents NoSQL injection
- **Input Validation**: Request validation middleware

---

## 🌍 Environment Variables

See `.env.example` for full list. Key variables:

```env
# Server
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb+srv://foodadmin:Yaswanth123@cluster0.0wuz8fl.mongodb.net/?appName=Cluster0

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_TOKEN_EXPIRE=7d

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:5174

# Multi-Tenant
ENABLE_SUBDOMAIN_MODE=true
DEFAULT_RESTAURANT_SUBDOMAIN=default
```

---

## 📈 Performance Optimizations

- **Database Indexes**: Compound indexes on restaurantId + other fields
- **Query Optimization**: Lean queries, projection, pagination
- **Caching**: Static file caching, response compression
- **Connection Pooling**: MongoDB connection pool
- **Gzip Compression**: Response compression middleware

---

## 🔧 Development Tips

### Local Subdomain Testing
Add to `/etc/hosts`:
```
127.0.0.1 pizzahut.localhost
127.0.0.1 burgerking.localhost
127.0.0.1 tacobell.localhost
```

### Using x-restaurant-id Header
For API testing without subdomains:
```bash
curl http://localhost:5000/api/menu \
  -H "x-restaurant-id: 60f7b3b3b3b3b3b3b3b3b3b3"
```

### Debugging Socket.io
Enable Socket.io debug logs:
```bash
DEBUG=socket.io* npm run dev
```

---

## 🚢 Deployment

### Production Checklist
- [ ] Set strong `JWT_SECRET` and `JWT_REFRESH_SECRET`
- [ ] Configure production `MONGODB_URI`
- [ ] Set `NODE_ENV=production`
- [ ] Configure CORS for production domains
- [ ] Set up SSL/TLS certificates
- [ ] Configure subdomain DNS records
- [ ] Set up monitoring and logging
- [ ] Create database backups
- [ ] Configure rate limiting
- [ ] Review security headers

### Build for Production
```bash
npm run build
npm start
```

### Using PM2
```bash
npm install -g pm2
pm2 start dist/server.js --name "patlinks-api"
pm2 save
pm2 startup
```

---

## 📚 API Documentation

Complete API documentation available in:
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

Includes:
- All endpoints with request/response examples
- Authentication flows
- WebSocket event reference
- Error handling guide
- Development tips

---

## 🐛 Troubleshooting

### Common Issues

**MongoDB Connection Failed**:
```bash
# Check MongoDB is running
mongod --version
# Verify connection string in .env
```

**Subdomain Not Working**:
```bash
# Use x-restaurant-id header instead
# OR add to /etc/hosts file
```

**Token Expired**:
```bash
# Use refresh token endpoint
POST /api/auth/refresh
```

**Data Isolation Issues**:
```bash
# Run isolation test
npm run test:isolation
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📝 License

This project is licensed under the MIT License.

---

## 👥 Support

- **Documentation**: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- **Issues**: GitHub Issues
- **Email**: support@patlinks.com

---

## 🎉 Success Metrics

✅ **100% Multi-Tenant**: All queries are tenant-scoped
✅ **80+ API Endpoints**: Comprehensive REST API
✅ **Real-time Updates**: Socket.io namespace isolation
✅ **Complete CRUD**: All resources with full operations
✅ **Advanced Analytics**: 7 analytics endpoints
✅ **Bulk Operations**: 7 bulk operation endpoints
✅ **Security**: JWT, rate limiting, sanitization
✅ **Data Isolation**: Verified with test suite

---

**Built with ❤️ for the Patlinks Platform**

*Last Updated: 2024-01-08 | Version: 3.0.0*
