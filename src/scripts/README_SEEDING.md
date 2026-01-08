# Database Seeding Scripts

Comprehensive seeding scripts for the Patlinks Food Ordering System backend.

## Overview

This directory contains 5 TypeScript seeding scripts that populate the database with test data for development and testing purposes.

## Scripts

### 1. seedPlans.ts
Creates 3 subscription plans with different pricing tiers.

**Plans Created:**
- **Basic** ($29/month): 20 tables, 100 menu items, 3 admins
- **Pro** ($79/month): 50 tables, 300 menu items, 10 admins
- **Enterprise** ($199/month): Unlimited resources

**Usage:**
```bash
ts-node src/scripts/seedPlans.ts
```

### 2. createSuperAdmin.ts
Creates a super admin account for platform management.

**Credentials:**
- Username: `superadmin`
- Password: `superadmin123`
- Email: `superadmin@patlinks.com`

**Usage:**
```bash
ts-node src/scripts/createSuperAdmin.ts
```

### 3. seedMultiTenant.ts
Creates complete multi-tenant test data for 3 restaurants.

**Restaurants Created:**
1. **Pizza Palace** (Pro plan)
   - Admin: admin1 / admin123
   - 6 categories, 17 menu items
   - 10 tables, 5 customers, 12 orders

2. **Burger Barn** (Basic plan)
   - Admin: admin2 / admin123
   - 6 categories, 17 menu items
   - 10 tables, 5 customers, 10 orders

3. **Sushi Spot** (Enterprise plan)
   - Admin: admin3 / admin123
   - 6 categories, 19 menu items
   - 10 tables, 5 customers, 15 orders

**Usage:**
```bash
ts-node src/scripts/seedMultiTenant.ts
```

### 4. seed.ts (Master Script)
Runs all seeding scripts in the correct order:
1. Seed Plans
2. Create Super Admin
3. Seed Multi-Tenant Data

**Usage:**
```bash
ts-node src/scripts/seed.ts
```

### 5. reset.ts
Clears all data from the database by deleting all collections.

**Warning:** This deletes ALL data\!

**Usage:**
```bash
ts-node src/scripts/reset.ts
```

## Quick Start

### Full Database Setup
Run all seeds at once:
```bash
ts-node src/scripts/seed.ts
```

### Reset and Re-seed
```bash
ts-node src/scripts/reset.ts
ts-node src/scripts/seed.ts
```

### Individual Seeds
Run specific seeds as needed:
```bash
# Seed only plans
ts-node src/scripts/seedPlans.ts

# Create only super admin
ts-node src/scripts/createSuperAdmin.ts

# Seed only restaurants
ts-node src/scripts/seedMultiTenant.ts
```

## Environment Configuration

Ensure your `.env` file contains:
```env
MONGODB_URI=mongodb+srv://foodadmin:Yaswanth123@cluster0.0wuz8fl.mongodb.net/?appName=Cluster0
```

If not set, defaults to: `mongodb+srv://foodadmin:Yaswanth123@cluster0.0wuz8fl.mongodb.net/?appName=Cluster0`

## Login Credentials

### Super Admin
```
URL: http://localhost:5000/api/super-admin/auth/login
Username: superadmin
Password: superadmin123
```

### Restaurant Admins

**Pizza Palace:**
```
Subdomain: pizzapalace.localhost:5000
Username: admin1
Password: admin123
```

**Burger Barn:**
```
Subdomain: burgerbarn.localhost:5000
Username: admin2
Password: admin123
```

**Sushi Spot:**
```
Subdomain: sushispot.localhost:5000
Username: admin3
Password: admin123
```

## Data Summary

After running the full seed (`seed.ts`), you'll have:

| Entity | Count | Details |
|--------|-------|---------|
| Plans | 3 | Basic, Pro, Enterprise |
| Super Admins | 1 | Platform administrator |
| Restaurants | 3 | Pizza Palace, Burger Barn, Sushi Spot |
| Restaurant Admins | 3 | One per restaurant |
| Categories | 18 | 6 per restaurant |
| Menu Items | 51 | 17-19 per restaurant |
| Tables | 30 | 10 per restaurant |
| Customers | 15 | 5 per restaurant |
| Orders | 37 | 10-15 per restaurant |

## Features

- All passwords are hashed using bcryptjs
- Proper multi-tenant data isolation
- Realistic restaurant data with diverse cuisines
- Orders with various statuses (received, preparing, ready, served, cancelled)
- Colorful console output with progress indicators
- Error handling and validation
- Each script can run standalone
- Exportable functions for use in other scripts

## Error Handling

If you encounter errors:

1. **MongoDB not running:**
   ```bash
   # Start MongoDB
   mongod
   ```

2. **Connection issues:**
   - Check MONGODB_URI in .env
   - Verify MongoDB is running on the correct port
   - Check database permissions

3. **Data conflicts:**
   - Run reset script first: `ts-node src/scripts/reset.ts`
   - Then re-run seeds

## Development Tips

- Run `reset.ts` before re-seeding to avoid duplicate key errors
- Scripts use proper TypeScript imports from `../modules/common/models/`
- All database connections are properly closed after execution
- Progress is logged with emojis for better visibility
- Each script exits with appropriate status codes

## Notes

- **Security:** Change default passwords in production\!
- **Data Isolation:** Each restaurant's data is completely isolated
- **Realistic Data:** Menu items, prices, and categories are realistic for testing
- **Order Statuses:** Orders have random statuses and timestamps for realistic testing
- **Customer Passwords:** All customer passwords are `customer123` (hashed)

## Support

For issues or questions:
1. Check MongoDB is running
2. Verify environment variables
3. Check script output for detailed error messages
4. Consult the main project documentation
