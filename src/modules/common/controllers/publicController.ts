import { Request, Response } from 'express';
import Restaurant from '../models/Restaurant';

/**
 * @desc    Get restaurant by subdomain (public endpoint for login)
 * @route   GET /api/public/restaurants/by-subdomain/:subdomain
 * @access  Public (no authentication required)
 */
export const getRestaurantBySubdomain = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { subdomain } = req.params;

    if (!subdomain || !subdomain.trim()) {
      res.status(400).json({
        success: false,
        message: 'Subdomain parameter is required',
      });
      return;
    }

    // Find restaurant by subdomain
    const restaurant = await Restaurant.findOne({
      subdomain: subdomain.toLowerCase().trim(),
    })
      .select('_id subdomain name branding isActive subscription')
      .lean();

    if (!restaurant) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found',
        code: 'RESTAURANT_NOT_FOUND',
      });
      return;
    }

    // Check if restaurant is active
    if (!restaurant.isActive) {
      res.status(403).json({
        success: false,
        message: 'This restaurant is currently inactive',
        code: 'RESTAURANT_INACTIVE',
      });
      return;
    }

    // Check subscription status
    if (restaurant.subscription.status !== 'active') {
      res.status(403).json({
        success: false,
        message: 'This restaurant subscription is not active',
        code: 'SUBSCRIPTION_INACTIVE',
        status: restaurant.subscription.status,
      });
      return;
    }

    // Return basic restaurant info (safe for public access)
    res.status(200).json({
      success: true,
      data: {
        restaurantId: restaurant._id,
        subdomain: restaurant.subdomain,
        name: restaurant.name,
        logo: restaurant.branding?.logo || null,
        branding: restaurant.branding || {
          primaryColor: '#6366f1',
          secondaryColor: '#8b5cf6',
          theme: 'light',
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching restaurant by subdomain:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
