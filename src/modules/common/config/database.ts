import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://foodadmin:Yaswanth123@cluster0.0wuz8fl.mongodb.net/?appName=Cluster0-ordering';

    // Connection with optimized pooling for high-performance queries
    await mongoose.connect(mongoURI, {
      maxPoolSize: 50, // Maximum number of connections in the pool (increased for super admin queries)
      minPoolSize: 10, // Minimum number of connections to maintain
      maxIdleTimeMS: 30000, // Close idle connections after 30 seconds
      serverSelectionTimeoutMS: 5000, // Timeout for server selection
      socketTimeoutMS: 45000, // Socket timeout
      family: 4, // Use IPv4, skip trying IPv6
    });

    console.log('MongoDB connected successfully with optimized connection pooling');

    // Run database migrations after connection
    await runMigrations();

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

/**
 * Run database migrations
 */
async function runMigrations(): Promise<void> {
  try {
    console.log('🔄 Running database migrations...');

    // Migration: Drop old email index from Customer collection
    await dropOldEmailIndex();

    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('⚠️  Migration error:', error);
    // Don't exit - allow server to continue
  }
}

/**
 * Drop old email index from Customer collection
 * The Customer model was changed to username-only authentication,
 * but old databases may still have restaurantId_1_email_1 index
 */
async function dropOldEmailIndex(): Promise<void> {
  try {
    const db = mongoose.connection.db;
    const customersCollection = db.collection('customers');

    // Get all indexes
    const indexes = await customersCollection.indexes();

    // Check if old email index exists
    const hasOldEmailIndex = indexes.some(
      (idx) => idx.name === 'restaurantId_1_email_1'
    );

    if (hasOldEmailIndex) {
      console.log('  🗑️  Dropping old email index: restaurantId_1_email_1');
      await customersCollection.dropIndex('restaurantId_1_email_1');
      console.log('  ✅ Successfully dropped old email index');
    }
  } catch (error: any) {
    // Ignore error if index doesn't exist
    if (error.code === 27 || error.codeName === 'IndexNotFound') {
      console.log('  ✅ Old email index already removed');
    } else {
      console.error('  ⚠️  Error dropping old email index:', error.message);
    }
  }
}

export default connectDB;
