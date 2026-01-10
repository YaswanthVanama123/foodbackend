/**
 * Migration: Drop old email index from Customer collection
 *
 * This migration removes the obsolete restaurantId_1_email_1 unique index
 * that causes duplicate key errors with username-only authentication.
 */

import mongoose from 'mongoose';
import Customer from '../modules/common/models/Customer';

export async function dropOldEmailIndex(): Promise<void> {
  try {
    const collection = Customer.collection;

    // Get all indexes
    const indexes = await collection.indexes();

    // Check if old email index exists
    const hasOldEmailIndex = indexes.some(
      (idx) => idx.name === 'restaurantId_1_email_1'
    );

    if (hasOldEmailIndex) {
      console.log('🗑️  Dropping old email index: restaurantId_1_email_1');
      await collection.dropIndex('restaurantId_1_email_1');
      console.log('✅ Successfully dropped old email index');
    } else {
      console.log('✅ Old email index already removed');
    }
  } catch (error: any) {
    // Ignore error if index doesn't exist
    if (error.code === 27 || error.codeName === 'IndexNotFound') {
      console.log('✅ Old email index already removed');
    } else {
      console.error('⚠️  Error dropping old email index:', error.message);
      // Don't throw - allow server to continue starting
    }
  }
}
