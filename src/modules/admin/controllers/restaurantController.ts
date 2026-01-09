import { Request, Response } from 'express';
import Restaurant from '../../common/models/Restaurant';

// @desc    Get restaurant by ID
// @route   GET /api/restaurants/:id
// @access  Private (Admin)
export const getRestaurantById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Verify that the admin is fetching their own restaurant
    if (req.restaurantId?.toString() !== id) {
      res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own restaurant',
      });
      return;
    }

    const restaurant = await Restaurant.findById(id).select('-__v');

    if (!restaurant) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: restaurant,
    });
  } catch (error: any) {
    console.error('Get restaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update restaurant settings
// @route   PUT /api/restaurants/:id
// @access  Private (Admin)
export const updateRestaurant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, branding } = req.body;

    // Verify that the admin is updating their own restaurant
    if (req.restaurantId?.toString() !== id) {
      res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own restaurant',
      });
      return;
    }

    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (branding !== undefined) updateData.branding = branding;

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!restaurant) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Restaurant updated successfully',
      data: restaurant,
    });
  } catch (error: any) {
    console.error('Update restaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
