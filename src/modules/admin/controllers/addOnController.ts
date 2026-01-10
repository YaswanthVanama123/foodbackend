import { Request, Response } from 'express';
import AddOn from '../../common/models/AddOn';

// @desc    Get all add-ons for restaurant
// @route   GET /api/admin/addons
// @access  Private (Admin)
export const getAddOns = async (req: Request, res: Response): Promise<void> => {
  try {
    const addOns = await AddOn.find({ restaurantId: req.restaurantId })
      .sort({ displayOrder: 1, name: 1 })
      .lean()
      .exec();

    res.status(200).json({
      success: true,
      data: addOns,
    });
  } catch (error: any) {
    console.error('Error fetching add-ons:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Get single add-on
// @route   GET /api/admin/addons/:id
// @access  Private (Admin)
export const getAddOnById = async (req: Request, res: Response): Promise<void> => {
  try {
    const addOn = await AddOn.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    })
      .lean()
      .exec();

    if (!addOn) {
      res.status(404).json({
        success: false,
        message: 'Add-on not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: addOn,
    });
  } catch (error: any) {
    console.error('Error fetching add-on:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Create new add-on
// @route   POST /api/admin/addons
// @access  Private (Admin)
export const createAddOn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, price, isAvailable, displayOrder } = req.body;

    // Validation
    if (!name || !name.trim()) {
      res.status(400).json({
        success: false,
        message: 'Add-on name is required',
      });
      return;
    }

    if (price === undefined || price === null) {
      res.status(400).json({
        success: false,
        message: 'Price is required',
      });
      return;
    }

    if (price < 0) {
      res.status(400).json({
        success: false,
        message: 'Price must be positive',
      });
      return;
    }

    // Check for duplicate name
    const existingAddOn = await AddOn.findOne({
      restaurantId: req.restaurantId,
      name: name.trim(),
    }).exec();

    if (existingAddOn) {
      res.status(400).json({
        success: false,
        message: 'An add-on with this name already exists',
      });
      return;
    }

    const addOn = await AddOn.create({
      restaurantId: req.restaurantId,
      name: name.trim(),
      description: description?.trim(),
      price,
      isAvailable: isAvailable !== undefined ? isAvailable : true,
      displayOrder: displayOrder || 0,
    });

    res.status(201).json({
      success: true,
      data: addOn,
      message: 'Add-on created successfully',
    });
  } catch (error: any) {
    console.error('Error creating add-on:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Update add-on
// @route   PUT /api/admin/addons/:id
// @access  Private (Admin)
export const updateAddOn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, price, isAvailable, displayOrder } = req.body;

    // Validation
    if (name !== undefined && (!name || !name.trim())) {
      res.status(400).json({
        success: false,
        message: 'Add-on name cannot be empty',
      });
      return;
    }

    if (price !== undefined && price < 0) {
      res.status(400).json({
        success: false,
        message: 'Price must be positive',
      });
      return;
    }

    // Check if add-on exists
    const addOn = await AddOn.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    }).exec();

    if (!addOn) {
      res.status(404).json({
        success: false,
        message: 'Add-on not found',
      });
      return;
    }

    // Check for duplicate name (excluding current add-on)
    if (name) {
      const existingAddOn = await AddOn.findOne({
        restaurantId: req.restaurantId,
        name: name.trim(),
        _id: { $ne: req.params.id },
      }).exec();

      if (existingAddOn) {
        res.status(400).json({
          success: false,
          message: 'An add-on with this name already exists',
        });
        return;
      }
    }

    // Update fields
    if (name) addOn.name = name.trim();
    if (description !== undefined) addOn.description = description?.trim();
    if (price !== undefined) addOn.price = price;
    if (isAvailable !== undefined) addOn.isAvailable = isAvailable;
    if (displayOrder !== undefined) addOn.displayOrder = displayOrder;

    await addOn.save();

    res.status(200).json({
      success: true,
      data: addOn,
      message: 'Add-on updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating add-on:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Delete add-on
// @route   DELETE /api/admin/addons/:id
// @access  Private (Admin)
export const deleteAddOn = async (req: Request, res: Response): Promise<void> => {
  try {
    const addOn = await AddOn.findOneAndDelete({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    }).exec();

    if (!addOn) {
      res.status(404).json({
        success: false,
        message: 'Add-on not found',
      });
      return;
    }

    // TODO: Optionally remove this addOn ID from all menu items that reference it
    // This can be done as a background task or with a pre-remove hook

    res.status(200).json({
      success: true,
      message: 'Add-on deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting add-on:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Toggle add-on availability
// @route   PATCH /api/admin/addons/:id/toggle-availability
// @access  Private (Admin)
export const toggleAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const addOn = await AddOn.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    }).exec();

    if (!addOn) {
      res.status(404).json({
        success: false,
        message: 'Add-on not found',
      });
      return;
    }

    addOn.isAvailable = !addOn.isAvailable;
    await addOn.save();

    res.status(200).json({
      success: true,
      data: addOn,
      message: `Add-on ${addOn.isAvailable ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error: any) {
    console.error('Error toggling add-on availability:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};
