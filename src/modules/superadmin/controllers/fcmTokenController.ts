import { Request, Response } from 'express';
import SuperAdmin from '../../common/models/SuperAdmin';

/**
 * Register FCM token for push notifications
 * Replaces any existing token (one device per super admin)
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

    // Find super admin and set/replace token
    const superAdmin = await SuperAdmin.findById(superAdminId);

    if (!superAdmin) {
      res.status(404).json({
        success: false,
        message: 'Super admin not found',
      });
      return;
    }

    const previousToken = superAdmin.fcmToken;

    // Replace token (overwrites any previous token)
    superAdmin.fcmToken = token;
    await superAdmin.save();

    console.log(`✅ FCM token ${previousToken ? 'updated' : 'registered'} for super admin ${superAdmin.username}`);

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
 * DELETE /api/super-admin/fcm-token
 */
export const removeFCMToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const superAdminId = (req as any).superAdminId;

    if (!superAdminId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    // Find super admin and clear token
    const superAdmin = await SuperAdmin.findById(superAdminId);

    if (!superAdmin) {
      res.status(404).json({
        success: false,
        message: 'Super admin not found',
      });
      return;
    }

    // Clear token
    superAdmin.fcmToken = undefined;
    await superAdmin.save();

    console.log(`✅ FCM token removed for super admin ${superAdmin.username}`);

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
 * Get FCM token for current super admin (for debugging)
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

    const superAdmin = await SuperAdmin.findById(superAdminId).select('fcmToken');

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
        token: superAdmin.fcmToken,
        hasToken: !!superAdmin.fcmToken,
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
