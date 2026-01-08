# Patlinks Backend Setup Guide

Complete setup documentation for the Patlinks Multi-Tenant Food Ordering Platform backend.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Running the Application](#running-the-application)
6. [Default Credentials](#default-credentials)
7. [API Endpoints](#api-endpoints)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)
10. [Production Deployment](#production-deployment)

---

## Prerequisites

Before setting up the Patlinks backend, ensure you have the following installed:

### Required Software

- **Node.js** (v18.x or higher)
  - Download: https://nodejs.org/
  - Verify: `node --version`

- **npm** (v9.x or higher) or **yarn**
  - Comes with Node.js
  - Verify: `npm --version`

- **MongoDB** (v6.x or higher)
  - Download: https://www.mongodb.com/try/download/community
  - Verify: `mongod --version`
  - Start MongoDB: `mongod` or `brew services start mongodb-community` (macOS)

### Optional Tools

- **MongoDB Compass** - GUI for MongoDB
- **Postman** or **Insomnia** - API testing
- **VS Code** - Recommended IDE with extensions:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features

---

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd patlinks/packages/backend
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Express.js (web framework)
- Mongoose (MongoDB ODM)
- bcryptjs (password hashing)
- jsonwebtoken (JWT authentication)
- TypeScript (type safety)
- And more...

### 3. Build TypeScript Files

```bash
npm run build
```

This compiles TypeScript files from `src/` to JavaScript in `dist/`.

---

## Environment Configuration

### 1. Create Environment File

Copy the example environment file:

```bash
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` with your configuration:

```env
# ============================================
# SERVER CONFIGURATION
# ============================================
NODE_ENV=development
PORT=5000

# ============================================
# DATABASE
# ============================================
MONGODB_URI=mongodb+srv://foodadmin:Yaswanth123@cluster0.0wuz8fl.mongodb.net/?appName=Cluster0

# ============================================
# JWT SECRETS
# ============================================
# Generate using: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production

# Token expiration
JWT_ACCESS_TOKEN_EXPIRE=7d
JWT_REFRESH_TOKEN_EXPIRE=30d

# ============================================
# CORS CONFIGURATION
# ============================================
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://localhost:3000

# ============================================
# MULTI-TENANT CONFIGURATION
# ============================================
ENABLE_SUBDOMAIN_MODE=true
DEFAULT_RESTAURANT_SUBDOMAIN=default

# ============================================
# SUPER ADMIN DEFAULTS
# ============================================
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_PASSWORD=SuperAdmin@123
SUPER_ADMIN_EMAIL=admin@patlinks.com

# ============================================
# FILE UPLOAD CONFIGURATION
# ============================================
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/webp,image/gif
UPLOAD_DIR=uploads
BASE_URL=http://localhost:5000

# ============================================
# RATE LIMITING
# ============================================
API_RATE_LIMIT=100
AUTH_RATE_LIMIT=5
```

### 3. Generate Secure Secrets

For production, generate secure random secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Use the output for `JWT_SECRET` and `JWT_REFRESH_SECRET`.

---

## Database Setup

### Quick Setup (Recommended)

Run the one-command setup script:

```bash
npm run setup
```

This will:
1. Check MongoDB connection
2. Verify database indexes
3. Seed initial data (super admin, plans, restaurants, etc.)
4. Display summary and next steps

### Manual Setup

If you prefer manual setup:

#### 1. Seed Database

```bash
npm run seed
```

This creates:
- 1 Super Admin (username: superadmin, password: superadmin123)
- 4 Subscription Plans (Free, Basic, Pro, Enterprise)
- 3 Sample Restaurants (Pizza Palace, Burger Barn, Sushi Spot)
- 3 Restaurant Admins (one per restaurant)
- Categories, menu items, tables, customers, orders per restaurant
- Sample audit logs

#### 2. Create Additional Super Admin (Optional)

Interactive mode:
```bash
npm run create-admin
```

Command-line mode:
```bash
npm run create-admin <username> <email> <password> <firstName> <lastName>
```

Example:
```bash
npm run create-admin admin2 admin2@patlinks.com SecurePass123 John Doe
```

#### 3. Generate Test Data (Optional)

Generate additional realistic test data:

```bash
npm run test-data
```

This creates:
- 100+ orders per restaurant with realistic timestamps
- 50+ audit logs per restaurant
- 5+ support tickets per restaurant
- Simulates peak hours (lunch: 12-2pm, dinner: 6-8pm)

#### 4. Reset Database

To drop all collections and reseed:

```bash
npm run reset
```

**WARNING**: This deletes ALL data!

---

## Running the Application

### Development Mode

Start the server with hot-reload:

```bash
npm run dev
```

The server will start on `http://localhost:5000`

### Production Mode

1. Build the project:
```bash
npm run build
```

2. Start the server:
```bash
npm start
```

### Verify Server is Running

Open your browser or use curl:

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "success": true,
  "message": "Server is running",
  "environment": "development",
  "timestamp": "2025-01-08T12:00:00.000Z",
  "uptime": 10.5
}
```

---

## Default Credentials

### Super Admin

**Purpose**: Platform management, create restaurants, manage subscriptions

- **Username**: `superadmin`
- **Password**: `superadmin123`
- **Email**: `admin@patlinks.com`
- **Login Endpoint**: `POST /api/super-admin/auth/login`

**Login Request**:
```bash
curl -X POST http://localhost:5000/api/super-admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "superadmin",
    "password": "superadmin123"
  }'
```

### Restaurant Admins

**Purpose**: Manage individual restaurant operations

| Restaurant | Username | Password | Subdomain |
|-----------|----------|----------|-----------|
| Pizza Palace | `pizzaadmin` | `admin123` | `pizzapalace` |
| Burger Barn | `burgeradmin` | `admin123` | `burgerbarn` |
| Sushi Spot | `sushiadmin` | `admin123` | `sushispot` |

**Login Endpoint**: `POST /api/auth/login`

**Login Request** (requires restaurant context):
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-restaurant-id: <restaurant_id>" \
  -d '{
    "username": "pizzaadmin",
    "password": "admin123"
  }'
```

### Customers

**Purpose**: Place orders, manage favorites, leave reviews

- **Email Pattern**: `john.doe@example.com`, `jane.smith@example.com`, etc.
- **Password**: `customer123` (all customers)
- **Login Endpoint**: `POST /api/customers/auth/login`

**Login Request**:
```bash
curl -X POST http://localhost:5000/api/customers/auth/login \
  -H "Content-Type: application/json" \
  -H "x-restaurant-id: <restaurant_id>" \
  -d '{
    "email": "john.doe@example.com",
    "password": "customer123"
  }'
```

---

## API Endpoints

### Core Endpoints

#### Health Check
```
GET /health
```
Returns server status and health information.

#### API Information
```
GET /api
```
Returns comprehensive API documentation and available endpoints.

### Super Admin Endpoints (Platform Level)

**Authentication**:
```
POST   /api/super-admin/auth/login          - Login
POST   /api/super-admin/auth/logout         - Logout
GET    /api/super-admin/auth/me             - Get current user
```

**Restaurant Management**:
```
GET    /api/super-admin/restaurants         - List all restaurants
POST   /api/super-admin/restaurants         - Create restaurant
GET    /api/super-admin/restaurants/:id     - Get restaurant details
PUT    /api/super-admin/restaurants/:id     - Update restaurant
DELETE /api/super-admin/restaurants/:id     - Delete restaurant
PATCH  /api/super-admin/restaurants/:id/status - Toggle status
```

**Subscription Plans**:
```
GET    /api/superadmin/plans                - List all plans
POST   /api/superadmin/plans                - Create plan
GET    /api/superadmin/plans/:id            - Get plan details
PUT    /api/superadmin/plans/:id            - Update plan
DELETE /api/superadmin/plans/:id            - Delete plan
```

**Support Tickets**:
```
GET    /api/superadmin/tickets              - List all tickets
POST   /api/superadmin/tickets              - Create ticket
GET    /api/superadmin/tickets/:id          - Get ticket details
PUT    /api/superadmin/tickets/:id          - Update ticket
POST   /api/superadmin/tickets/:id/messages - Add message
```

**Analytics & Audit**:
```
GET    /api/superadmin/analytics            - Platform analytics
GET    /api/superadmin/audit-logs           - Audit logs
```

### Restaurant Admin Endpoints (Tenant Level)

**Note**: All restaurant endpoints require `x-restaurant-id` header in development mode.

**Authentication**:
```
POST   /api/auth/login                      - Login
POST   /api/auth/logout                     - Logout
GET    /api/auth/me                         - Get current user
```

**Menu Management**:
```
GET    /api/categories                      - List categories
POST   /api/categories                      - Create category
PUT    /api/categories/:id                  - Update category
DELETE /api/categories/:id                  - Delete category

GET    /api/menu                            - List menu items
POST   /api/menu                            - Create menu item
GET    /api/menu/:id                        - Get menu item
PUT    /api/menu/:id                        - Update menu item
DELETE /api/menu/:id                        - Delete menu item
```

**Order Management**:
```
GET    /api/orders                          - List orders
POST   /api/orders                          - Create order
GET    /api/orders/:id                      - Get order details
PUT    /api/orders/:id                      - Update order
PATCH  /api/orders/:id/status               - Update order status
```

**Table Management**:
```
GET    /api/tables                          - List tables
POST   /api/tables                          - Create table
PUT    /api/tables/:id                      - Update table
DELETE /api/tables/:id                      - Delete table
```

**Analytics**:
```
GET    /api/dashboard                       - Dashboard statistics
GET    /api/analytics                       - Detailed analytics
```

### Customer Endpoints (Tenant Level)

**Authentication**:
```
POST   /api/customers/auth/register         - Register
POST   /api/customers/auth/login            - Login
POST   /api/customers/auth/logout           - Logout
GET    /api/customers/auth/me               - Get profile
```

**Shopping**:
```
GET    /api/customers/cart                  - View cart
POST   /api/customers/cart                  - Add to cart
PUT    /api/customers/cart/:itemId          - Update cart item
DELETE /api/customers/cart/:itemId          - Remove from cart

GET    /api/customers/favorites             - View favorites
POST   /api/customers/favorites/:itemId     - Add favorite
DELETE /api/customers/favorites/:itemId     - Remove favorite
```

**Orders**:
```
GET    /api/customers/orders                - Order history
POST   /api/customers/orders                - Place order
GET    /api/customers/orders/:id            - Order details
```

**Reviews**:
```
GET    /api/reviews/:menuItemId             - Get reviews
POST   /api/reviews/:menuItemId             - Add review
```

---

## Testing

### Manual API Testing

#### Using cURL

**Test Super Admin Login**:
```bash
curl -X POST http://localhost:5000/api/super-admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "superadmin",
    "password": "superadmin123"
  }'
```

**Test Restaurant List**:
```bash
curl -X GET http://localhost:5000/api/super-admin/restaurants \
  -H "Authorization: Bearer <your-jwt-token>"
```

#### Using Postman/Insomnia

1. Import the API collection (if available)
2. Set environment variables:
   - `baseUrl`: `http://localhost:5000`
   - `token`: `<your-jwt-token>`
3. Test endpoints

### Integration Testing

Run existing test scripts:

```bash
# Test data isolation
npm run test:isolation

# Test bulk operations
node test-bulk-operations.js
```

---

## Troubleshooting

### MongoDB Connection Issues

**Problem**: `Error connecting to MongoDB`

**Solutions**:
1. Ensure MongoDB is running:
   ```bash
   # macOS
   brew services start mongodb-community

   # Linux
   sudo systemctl start mongod

   # Windows
   net start MongoDB
   ```

2. Check connection string in `.env`:
   ```env
   MONGODB_URI=mongodb+srv://foodadmin:Yaswanth123@cluster0.0wuz8fl.mongodb.net/?appName=Cluster0
   ```

3. Verify MongoDB is accessible:
   ```bash
   mongo --eval "db.adminCommand('ping')"
   ```

### Port Already in Use

**Problem**: `Error: listen EADDRINUSE: address already in use :::5000`

**Solutions**:
1. Find and kill the process using port 5000:
   ```bash
   # macOS/Linux
   lsof -ti:5000 | xargs kill -9

   # Windows
   netstat -ano | findstr :5000
   taskkill /PID <PID> /F
   ```

2. Or change the port in `.env`:
   ```env
   PORT=5001
   ```

### TypeScript Build Errors

**Problem**: `Error: Cannot find module` or compilation errors

**Solutions**:
1. Clean and rebuild:
   ```bash
   rm -rf dist
   npm run build
   ```

2. Check TypeScript version:
   ```bash
   npx tsc --version
   ```

3. Reinstall dependencies:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### Seed Script Fails

**Problem**: Seed script throws errors

**Solutions**:
1. Ensure MongoDB is running
2. Drop database and retry:
   ```bash
   mongo patlinks --eval "db.dropDatabase()"
   npm run seed
   ```

3. Check for duplicate key errors - may need to manually clean collections

### CORS Issues

**Problem**: Frontend cannot access API

**Solutions**:
1. Add frontend URL to CORS_ORIGIN in `.env`:
   ```env
   CORS_ORIGIN=http://localhost:5173,http://localhost:3000
   ```

2. Restart the server after changing .env

### Authentication Issues

**Problem**: `401 Unauthorized` or `403 Forbidden`

**Solutions**:
1. Verify JWT token is valid and not expired
2. Check Authorization header format: `Bearer <token>`
3. For tenant endpoints, ensure `x-restaurant-id` header is set
4. Regenerate JWT secrets if needed

---

## Production Deployment

### Preparation

1. **Generate Secure Secrets**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
   Update `JWT_SECRET` and `JWT_REFRESH_SECRET` in production `.env`

2. **Update Environment Variables**:
   ```env
   NODE_ENV=production
   MONGODB_URI=<production-mongodb-uri>
   CORS_ORIGIN=https://yourdomain.com
   BASE_URL=https://api.yourdomain.com
   ```

3. **Change Default Passwords**:
   - Create new super admin with secure password
   - Update all default credentials
   - Remove or disable seed data accounts

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

Or use a process manager:

```bash
# Using PM2
npm install -g pm2
pm2 start dist/server.js --name patlinks-backend

# Using systemd (Linux)
sudo systemctl start patlinks-backend
```

### Environment Setup

**Recommended Production Stack**:
- **Server**: Ubuntu/Debian Linux
- **Web Server**: Nginx (reverse proxy)
- **Database**: MongoDB Atlas or self-hosted MongoDB replica set
- **Process Manager**: PM2 or systemd
- **SSL**: Let's Encrypt (Certbot)
- **Monitoring**: PM2 Monitor, MongoDB Atlas monitoring

### Security Checklist

- [ ] Change all default passwords
- [ ] Use secure JWT secrets (64+ characters)
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall rules
- [ ] Enable MongoDB authentication
- [ ] Use environment variables for secrets
- [ ] Enable rate limiting (already configured)
- [ ] Regular security updates
- [ ] Backup strategy in place
- [ ] Monitoring and alerting configured

---

## Additional Resources

### Documentation Files

- **API_DOCUMENTATION.md** - Complete API reference
- **ADMIN_API_DOCUMENTATION.md** - Admin-specific endpoints
- **ARCHITECTURE_IMPLEMENTATION.md** - System architecture
- **AUDIT_LOGGING_DOCUMENTATION.md** - Audit logging system
- **SUBSCRIPTION_API.md** - Subscription management
- **TICKET_API_DOCUMENTATION.md** - Support ticket system

### Useful Commands

```bash
# View all available scripts
npm run

# Check server status
curl http://localhost:5000/health

# View server logs (if using PM2)
pm2 logs patlinks-backend

# Monitor server (if using PM2)
pm2 monit

# Restart server (if using PM2)
pm2 restart patlinks-backend
```

### Support

For issues, questions, or contributions:
- Check existing documentation
- Review error logs
- Search for similar issues
- Contact the development team

---

## Quick Reference

### Installation
```bash
npm install
cp .env.example .env
# Edit .env with your configuration
npm run setup
```

### Development
```bash
npm run dev              # Start dev server
npm run build            # Build TypeScript
npm run seed             # Seed database
npm run reset            # Reset database
```

### Production
```bash
npm run build            # Build for production
npm start                # Start production server
```

### Database Scripts
```bash
npm run setup            # One-command setup
npm run seed             # Seed initial data
npm run reset            # Drop and reseed
npm run create-admin     # Create super admin
npm run test-data        # Generate test data
```

---

**Last Updated**: January 2025
**Version**: 3.1.0
**Platform**: Patlinks Multi-Tenant Food Ordering System
