# Backend Initialization Scripts

This directory contains production-ready scripts for setting up and managing the Patlinks backend database.

## Available Scripts

### 1. Setup Script (`setup.js`)

**One-command setup for the entire backend.**

```bash
npm run setup
```

**What it does:**
- Checks MongoDB connection
- Verifies database indexes
- Seeds initial data (super admin, plans, restaurants)
- Displays summary and credentials

**Use when:**
- First-time setup
- After cloning the repository
- Setting up a new development environment

---

### 2. Seed Database (`seed-database.js`)

**Complete database seeding with sample data.**

```bash
npm run seed
```

**What it creates:**
- 1 Super Admin (username: superadmin, password: superadmin123)
- 4 Subscription Plans (Starter, Professional, Enterprise)
- 3 Sample Restaurants:
  - Pizza Palace (pizzapalace)
  - Burger Barn (burgerbarn)
  - Sushi Spot (sushispot)
- 3 Restaurant Admins (one per restaurant)
- 3-5 Categories per restaurant
- 10-15 Menu items per restaurant
- 5-20 Tables per restaurant
- 10-20 Sample orders per restaurant
- 5+ Customers per restaurant
- Sample audit logs

**Use when:**
- You want fresh sample data
- Testing with realistic data
- Demonstrating the platform

**Output:**
- Detailed summary of all created data
- Default credentials for all accounts
- Restaurant subdomains

---

### 3. Reset Database (`reset-database.js`)

**Drop all collections and reseed.**

```bash
npm run reset
```

**WARNING: This deletes ALL data in the database!**

**What it does:**
1. Prompts for confirmation
2. Drops all MongoDB collections
3. Runs the seed script
4. Creates fresh data

**Use when:**
- Starting over from scratch
- Cleaning up test data
- Resetting to initial state

---

### 4. Create Super Admin (`create-super-admin.js`)

**Standalone script to create super admin accounts.**

```bash
# Interactive mode
npm run create-admin

# Command-line mode
npm run create-admin <username> <email> <password> <firstName> <lastName>
```

**Examples:**

Interactive:
```bash
npm run create-admin
# Follow the prompts
```

Direct:
```bash
npm run create-admin johndoe john@example.com SecurePass123 John Doe
```

**Features:**
- Input validation
- Password confirmation
- Duplicate checking
- Detailed success message with login instructions

**Use when:**
- Creating the first super admin
- Adding additional super admin users
- Need custom super admin credentials

---

### 5. Test Data Generator (`test-data-generator.js`)

**Generate additional realistic test data.**

```bash
npm run test-data
```

**What it generates:**
- 100+ orders per restaurant with realistic timestamps
- 50+ audit logs per restaurant
- 5+ support tickets with conversations
- Peak hours simulation (lunch: 12-2pm, dinner: 6-8pm)
- Various order statuses with proper progression
- Customer behavior patterns

**Use when:**
- Testing analytics dashboards
- Performance testing with larger datasets
- UI/UX testing with realistic data
- Testing search and filter functionality
- Validating report generation

**Requirements:**
- Must run after seed script (requires existing restaurants)

---

## Usage Examples

### Quick Start

First time setup:
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your settings

# 3. Build TypeScript
npm run build

# 4. Run setup
npm run setup

# 5. Start server
npm run dev
```

### Development Workflow

Reset database and add test data:
```bash
# Reset everything
npm run reset

# Add more test data
npm run test-data

# Start development server
npm run dev
```

### Creating Custom Super Admin

```bash
npm run create-admin superuser super@example.com MySecurePass456 Super User
```

### Testing Different Scenarios

1. **Small restaurant (Starter plan):**
   - Use Pizza Palace (limited tables/menu items)

2. **Medium restaurant (Professional plan):**
   - Use Burger Barn (more capacity)

3. **Large restaurant (Enterprise plan):**
   - Use Sushi Spot (unlimited resources)

---

## Script Architecture

### CommonJS Format

All scripts use CommonJS (`require`/`module.exports`) for Node.js compatibility without TypeScript.

### Error Handling

- Connection error handling
- Input validation
- Duplicate prevention
- Transaction support (where applicable)
- Graceful shutdown (Ctrl+C)

### Logging

- Color-coded console output
- Detailed progress messages
- Summary statistics
- Default credentials display

---

## Environment Requirements

### Required Environment Variables

```env
MONGODB_URI=mongodb+srv://foodadmin:Yaswanth123@cluster0.0wuz8fl.mongodb.net/?appName=Cluster0
JWT_SECRET=your-secret-key
PORT=5000
```

### Optional Environment Variables

```env
SUPER_ADMIN_USERNAME=customadmin
SUPER_ADMIN_PASSWORD=CustomPass123
SUPER_ADMIN_EMAIL=admin@custom.com
```

---

## Data Structure

### Super Admin
- Platform-level access
- Can create/manage restaurants
- Can view global analytics
- Can manage subscriptions

### Restaurant Admin
- Restaurant-level access
- Can manage menu, orders, tables
- Can view restaurant analytics
- Scoped to their restaurant

### Customer
- Customer-facing features
- Can place orders
- Can manage favorites
- Can leave reviews

---

## Default Credentials

### Super Admin
- Username: `superadmin`
- Password: `superadmin123`
- Email: `admin@patlinks.com`
- Login: `POST /api/super-admin/auth/login`

### Restaurant Admins

| Restaurant | Username | Password | Subdomain |
|-----------|----------|----------|-----------|
| Pizza Palace | `pizzaadmin` | `admin123` | `pizzapalace` |
| Burger Barn | `burgeradmin` | `admin123` | `burgerbarn` |
| Sushi Spot | `sushiadmin` | `admin123` | `sushispot` |

Login: `POST /api/auth/login` (with `x-restaurant-id` header)

### Customers
- Email: Various (john.doe@example.com, etc.)
- Password: `customer123` (all customers)
- Login: `POST /api/customers/auth/login`

---

## Troubleshooting

### MongoDB Connection Failed

**Problem:** `Error connecting to MongoDB`

**Solutions:**
1. Ensure MongoDB is running: `mongod`
2. Check connection string in `.env`
3. Verify MongoDB port (default: 27017)

### Duplicate Key Error

**Problem:** `E11000 duplicate key error`

**Solutions:**
1. Drop the database: `mongo patlinks --eval "db.dropDatabase()"`
2. Run reset script: `npm run reset`
3. Use different credentials

### Script Hangs or Freezes

**Problem:** Script doesn't exit

**Solutions:**
1. Press Ctrl+C to cancel
2. Check MongoDB connection
3. Ensure no other processes are using the database

### Build Errors

**Problem:** `Cannot find module` or TypeScript errors

**Solutions:**
1. Clean build: `rm -rf dist && npm run build`
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Check TypeScript version: `npx tsc --version`

---

## Best Practices

### Development

1. **Use setup script for first-time setup**
   ```bash
   npm run setup
   ```

2. **Reset database when testing from scratch**
   ```bash
   npm run reset
   ```

3. **Generate test data for realistic scenarios**
   ```bash
   npm run test-data
   ```

### Production

1. **Never use default credentials in production**
   - Create custom super admin
   - Change all default passwords

2. **Use strong JWT secrets**
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

3. **Backup before running scripts**
   - Especially reset script
   - Use MongoDB backup tools

4. **Review generated data**
   - Remove test accounts
   - Verify subscription plans
   - Check configuration

---

## Additional Resources

- **Setup Guide:** `/docs/SETUP.md`
- **API Documentation:** `/API_DOCUMENTATION.md`
- **Admin API:** `/ADMIN_API_DOCUMENTATION.md`
- **Architecture:** `/ARCHITECTURE_IMPLEMENTATION.md`

---

## Script Comparison

| Script | Destructive | Time | Use Case |
|--------|-------------|------|----------|
| setup.js | No* | 10-15s | First-time setup |
| seed-database.js | Yes† | 5-10s | Create sample data |
| reset-database.js | Yes | 10-15s | Start fresh |
| create-super-admin.js | No | <5s | Add super admin |
| test-data-generator.js | No | 10-20s | Add test data |

\* Only if database is empty
† Clears existing data before seeding

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review `/docs/SETUP.md`
3. Check MongoDB logs
4. Review script error messages
5. Contact the development team

---

**Last Updated:** January 2025
**Version:** 1.0.0
