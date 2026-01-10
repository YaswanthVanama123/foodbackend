/**
 * Script to drop old email index from Customer collection
 *
 * The Customer model was changed to use username-only authentication,
 * but MongoDB still has an old `restaurantId_1_email_1` unique index
 * from a previous schema version. This causes duplicate key errors
 * when multiple users register without email (email: null).
 *
 * Run this script once to clean up the old index:
 * node scripts/drop-old-email-index.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/patlinks';

async function dropOldEmailIndex() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const customersCollection = db.collection('customers');

    console.log('\n📋 Current indexes on customers collection:');
    const indexes = await customersCollection.indexes();
    indexes.forEach((index) => {
      console.log(`   - ${index.name}:`, JSON.stringify(index.key));
    });

    // Check if the old email index exists
    const oldEmailIndex = indexes.find(
      (idx) => idx.name === 'restaurantId_1_email_1'
    );

    if (oldEmailIndex) {
      console.log('\n🗑️  Dropping old email index: restaurantId_1_email_1');
      await customersCollection.dropIndex('restaurantId_1_email_1');
      console.log('✅ Successfully dropped old email index');
    } else {
      console.log('\n✅ Old email index does not exist (already dropped or never created)');
    }

    console.log('\n📋 Remaining indexes:');
    const finalIndexes = await customersCollection.indexes();
    finalIndexes.forEach((index) => {
      console.log(`   - ${index.name}:`, JSON.stringify(index.key));
    });

    console.log('\n✅ Index cleanup complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

dropOldEmailIndex();
