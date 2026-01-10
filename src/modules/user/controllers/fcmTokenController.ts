import { Request, Response } from 'express';
import Customer from '../../common/models/Customer';

/**
 * Register FCM token for push notifications
 * Replaces any existing token (one device per customer)
 * POST /api/customers/fcm-token
 */
export const registerFCMToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    const customerId = req.customer?._id;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    if (!token || typeof token !== 'string') {
      res.status(400).json({
        success: false,
        message: 'FCM token is required',
      });
      return;
    }

    // Find customer and set/replace token
    const customer = await Customer.findById(customerId);

    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
      return;
    }

    const previousToken = customer.fcmToken;

    // Replace token (overwrites any previous token)
    customer.fcmToken = token;
    await customer.save();

    console.log(`✅ FCM token ${previousToken ? 'updated' : 'registered'} for customer ${customer.username}`);

    res.status(200).json({
      success: true,
      message: `FCM token ${previousToken ? 'updated' : 'registered'} successfully`,
      data: {
        tokenSet: true,
      },
    });
  } catch (error: any) {
    console.error('Error registering FCM token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register FCM token',
      error: error.message,
    });
  }
};

/**
 * Remove FCM token (on logout or device removal)
 * DELETE /api/customers/fcm-token
 */
export const removeFCMToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.customer?._id;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    // Find customer and clear token
    const customer = await Customer.findById(customerId);

    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
      return;
    }

    // Clear token
    customer.fcmToken = undefined;
    await customer.save();

    console.log(`✅ FCM token removed for customer ${customer.username}`);

    res.status(200).json({
      success: true,
      message: 'FCM token removed successfully',
      data: {
        tokenSet: false,
      },
    });
  } catch (error: any) {
    console.error('Error removing FCM token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove FCM token',
      error: error.message,
    });
  }
};

/**
 * Get FCM token for current user (for debugging)
 * GET /api/customers/fcm-token
 */
export const getFCMToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.customer?._id;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const customer = await Customer.findById(customerId).select('fcmToken');

    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        token: customer.fcmToken,
        hasToken: !!customer.fcmToken,
      },
    });
  } catch (error: any) {
    console.error('Error fetching FCM token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FCM token',
      error: error.message,
    });
  }
};
