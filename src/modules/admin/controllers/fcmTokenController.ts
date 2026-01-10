import { Request, Response } from 'express';
import Admin from '../../common/models/Admin';

/**
 * Register FCM token for push notifications
 * Adds token to array (supports multiple devices/browsers per admin)
 * POST /api/admin/fcm-token
 */
export const registerFCMToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    const adminId = req.admin?._id;

    if (!adminId) {
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
    const admin = await Admin.findByIdAndUpdate(
      adminId,
      { $addToSet: { fcmTokens: token } }, // Add to set prevents duplicates
      { new: true, select: 'username fcmTokens' }
    );

    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
      return;
    }

    console.log(`✅ FCM token registered for admin ${admin.username} (${admin.fcmTokens?.length || 0} total devices)`);

    res.status(200).json({
      success: true,
      message: 'FCM token registered successfully',
      data: {
        tokenSet: true,
        totalDevices: admin.fcmTokens?.length || 0,
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
 * DELETE /api/admin/fcm-token
 */
export const removeFCMToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    const adminId = req.admin?._id;

    if (!adminId) {
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
    const admin = await Admin.findByIdAndUpdate(
      adminId,
      { $pull: { fcmTokens: token } }, // Remove specific token
      { new: true, select: 'username fcmTokens' }
    );

    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
      return;
    }

    console.log(`✅ FCM token removed for admin ${admin.username} (${admin.fcmTokens?.length || 0} remaining devices)`);

    res.status(200).json({
      success: true,
      message: 'FCM token removed successfully',
      data: {
        tokenSet: (admin.fcmTokens?.length || 0) > 0,
        totalDevices: admin.fcmTokens?.length || 0,
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
 * Get FCM tokens for current admin (for debugging)
 * GET /api/admin/fcm-token
 */
export const getFCMToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.admin?._id;

    if (!adminId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const admin = await Admin.findById(adminId).select('fcmTokens');

    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        tokens: admin.fcmTokens || [],
        hasToken: (admin.fcmTokens?.length || 0) > 0,
        totalDevices: admin.fcmTokens?.length || 0,
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
