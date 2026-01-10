import { Request, Response } from 'express';
import Admin from '../../common/models/Admin';

/**
 * Register FCM token for push notifications
 * Replaces any existing token (one device per admin)
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

    // Find admin and set/replace token
    const admin = await Admin.findById(adminId);

    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
      return;
    }

    const previousToken = admin.fcmToken;

    // Replace token (overwrites any previous token)
    admin.fcmToken = token;
    await admin.save();

    console.log(`✅ FCM token ${previousToken ? 'updated' : 'registered'} for admin ${admin.username}`);

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
 * DELETE /api/admin/fcm-token
 */
export const removeFCMToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.admin?._id;

    if (!adminId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    // Find admin and clear token
    const admin = await Admin.findById(adminId);

    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
      return;
    }

    // Clear token
    admin.fcmToken = undefined;
    await admin.save();

    console.log(`✅ FCM token removed for admin ${admin.username}`);

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
 * Get FCM token for current admin (for debugging)
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

    const admin = await Admin.findById(adminId).select('fcmToken');

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
        token: admin.fcmToken,
        hasToken: !!admin.fcmToken,
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
