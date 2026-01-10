import { Request, Response } from 'express';
import SuperAdmin from '../../common/models/SuperAdmin';

/**
 * Register FCM token for push notifications
 * Adds token to array (supports multiple devices/browsers per super admin)
 * POST /api/super-admin/fcm-token
 */
export const registerFCMToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    const superAdminId = (req as any).superAdminId;

    if (!superAdminId) {
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

    // Add token to array if not already present (using $addToSet)
    const superAdmin = await SuperAdmin.findByIdAndUpdate(
      superAdminId,
      { $addToSet: { fcmTokens: token } }, // Add to set prevents duplicates
      { new: true, select: 'username fcmTokens' }
    );

    if (!superAdmin) {
      res.status(404).json({
        success: false,
        message: 'Super admin not found',
      });
      return;
    }

    console.log(`✅ FCM token registered for super admin ${superAdmin.username} (${superAdmin.fcmTokens?.length || 0} total devices)`);

    res.status(200).json({
      success: true,
      message: 'FCM token registered successfully',
      data: {
        tokenSet: true,
        totalDevices: superAdmin.fcmTokens?.length || 0,
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
 * DELETE /api/super-admin/fcm-token
 */
export const removeFCMToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    const superAdminId = (req as any).superAdminId;

    if (!superAdminId) {
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

    // Remove specific token from array (using $pull)
    const superAdmin = await SuperAdmin.findByIdAndUpdate(
      superAdminId,
      { $pull: { fcmTokens: token } }, // Remove specific token
      { new: true, select: 'username fcmTokens' }
    );

    if (!superAdmin) {
      res.status(404).json({
        success: false,
        message: 'Super admin not found',
      });
      return;
    }

    console.log(`✅ FCM token removed for super admin ${superAdmin.username} (${superAdmin.fcmTokens?.length || 0} remaining devices)`);

    res.status(200).json({
      success: true,
      message: 'FCM token removed successfully',
      data: {
        tokenSet: (superAdmin.fcmTokens?.length || 0) > 0,
        totalDevices: superAdmin.fcmTokens?.length || 0,
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
 * Get FCM tokens for current super admin (for debugging)
 * GET /api/super-admin/fcm-token
 */
export const getFCMToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const superAdminId = (req as any).superAdminId;

    if (!superAdminId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const superAdmin = await SuperAdmin.findById(superAdminId).select('fcmTokens');

    if (!superAdmin) {
      res.status(404).json({
        success: false,
        message: 'Super admin not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        tokens: superAdmin.fcmTokens || [],
        hasToken: (superAdmin.fcmTokens?.length || 0) > 0,
        totalDevices: superAdmin.fcmTokens?.length || 0,
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
