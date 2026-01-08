import { Router } from 'express';
import {
  getAllSubscriptions,
  getSubscriptionsByRestaurant,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  renewSubscription,
  getSubscriptionById,
  deleteSubscription,
} from '../controllers/subscriptionController';
import { superAdminAuth } from '../common/middleware/authMiddleware';

const router = Router();

/**
 * Subscription Management Routes
 * All routes require super admin authentication
 * Base path: /api/superadmin/subscriptions
 */

/**
 * @route   GET /api/superadmin/subscriptions
 * @desc    Get all subscriptions with pagination, filters, and statistics
 * @access  Private (Super Admin)
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Items per page (default: 20)
 * @query   {string} status - Filter by status (active|cancelled|expired|pending)
 * @query   {string} billingCycle - Filter by billing cycle (monthly|yearly)
 * @query   {boolean} autoRenew - Filter by auto-renew status
 * @query   {string} search - Search in restaurant name, subdomain, or email
 * @query   {string} sortBy - Sort field (default: createdAt)
 * @query   {string} sortOrder - Sort order (asc|desc, default: desc)
 * @query   {boolean} expiringSoon - Filter expiring subscriptions (within 30 days)
 */
router.get('/', superAdminAuth, getAllSubscriptions);

/**
 * @route   GET /api/superadmin/subscriptions/restaurant/:restaurantId
 * @desc    Get all subscriptions for a specific restaurant
 * @access  Private (Super Admin)
 * @param   {string} restaurantId - Restaurant ID
 */
router.get('/restaurant/:restaurantId', superAdminAuth, getSubscriptionsByRestaurant);

/**
 * @route   GET /api/superadmin/subscriptions/:id
 * @desc    Get subscription by ID with detailed statistics
 * @access  Private (Super Admin)
 * @param   {string} id - Subscription ID
 */
router.get('/:id', superAdminAuth, getSubscriptionById);

/**
 * @route   POST /api/superadmin/subscriptions
 * @desc    Create new subscription
 * @access  Private (Super Admin)
 * @body    {string} restaurantId - Restaurant ID (required)
 * @body    {string} planId - Plan ID (optional)
 * @body    {string} status - Subscription status (default: pending)
 * @body    {Date} startDate - Start date (default: now)
 * @body    {Date} endDate - End date (required)
 * @body    {number} amount - Subscription amount (required)
 * @body    {string} currency - Currency code (default: USD)
 * @body    {string} billingCycle - Billing cycle (monthly|yearly, required)
 * @body    {boolean} autoRenew - Auto-renew status (default: true)
 * @body    {string} notes - Additional notes (optional)
 */
router.post('/', superAdminAuth, createSubscription);

/**
 * @route   PUT /api/superadmin/subscriptions/:id
 * @desc    Update subscription
 * @access  Private (Super Admin)
 * @param   {string} id - Subscription ID
 * @body    {string} planId - Plan ID (optional)
 * @body    {string} status - Subscription status (optional)
 * @body    {Date} endDate - End date (optional)
 * @body    {Date} renewalDate - Renewal date (optional)
 * @body    {number} amount - Subscription amount (optional)
 * @body    {string} currency - Currency code (optional)
 * @body    {string} billingCycle - Billing cycle (optional)
 * @body    {boolean} autoRenew - Auto-renew status (optional)
 * @body    {string} notes - Additional notes (optional)
 * @body    {object} paymentRecord - Add payment record (optional)
 */
router.put('/:id', superAdminAuth, updateSubscription);

/**
 * @route   PATCH /api/superadmin/subscriptions/:id/cancel
 * @desc    Cancel subscription
 * @access  Private (Super Admin)
 * @param   {string} id - Subscription ID
 * @body    {string} cancellationReason - Reason for cancellation (optional)
 * @body    {boolean} immediateTermination - Terminate immediately (default: false)
 */
router.patch('/:id/cancel', superAdminAuth, cancelSubscription);

/**
 * @route   POST /api/superadmin/subscriptions/:id/renew
 * @desc    Renew subscription
 * @access  Private (Super Admin)
 * @param   {string} id - Subscription ID
 * @body    {number} amount - New amount (optional)
 * @body    {string} billingCycle - New billing cycle (optional)
 * @body    {number} extensionMonths - Months to extend (optional)
 * @body    {object} paymentRecord - Payment record for renewal (optional)
 */
router.post('/:id/renew', superAdminAuth, renewSubscription);

/**
 * @route   DELETE /api/superadmin/subscriptions/:id
 * @desc    Delete subscription (only non-active subscriptions)
 * @access  Private (Super Admin)
 * @param   {string} id - Subscription ID
 */
router.delete('/:id', superAdminAuth, deleteSubscription);

export default router;
