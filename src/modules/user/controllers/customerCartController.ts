import { Request, Response } from 'express';
import CustomerCart from '../common/models/CustomerCart';
import MenuItem from '../common/models/MenuItem';

// @desc    Get customer's cart
// @route   GET /api/customers/cart
// @access  Private (Customer)
export const getCart = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get authenticated customer
    const customerId = req.customer?._id;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: 'Customer authentication required',
      });
      return;
    }

    // Find or create cart for this customer
    let cart = await CustomerCart.findOne({
      customerId,
      restaurantId: req.restaurantId,
    })
      .populate('items.menuItemId', 'name price isAvailable')
      .lean()
      .exec();

    // If no cart exists, return empty cart
    if (!cart) {
      cart = {
        customerId,
        restaurantId: req.restaurantId!,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
    }

    // Calculate cart totals
    let subtotal = 0;
    const validItems = cart.items.filter((item: any) => {
      // Filter out items that are no longer available
      if (!item.menuItemId || !item.menuItemId.isAvailable) {
        return false;
      }

      // Calculate item subtotal
      let itemTotal = item.price * item.quantity;
      if (item.customizations) {
        const customizationTotal = item.customizations.reduce(
          (sum: number, custom: any) => sum + custom.priceModifier,
          0
        );
        itemTotal += customizationTotal * item.quantity;
      }
      subtotal += itemTotal;
      return true;
    });

    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax;

    res.status(200).json({
      success: true,
      data: {
        ...cart,
        items: validItems,
        summary: {
          itemCount: validItems.length,
          subtotal: Math.round(subtotal * 100) / 100,
          tax: Math.round(tax * 100) / 100,
          total: Math.round(total * 100) / 100,
        },
      },
    });
  } catch (error: any) {
    console.error('Get cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Save/Update customer's cart
// @route   POST /api/customers/cart
// @access  Private (Customer)
export const saveCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.customer?._id;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: 'Customer authentication required',
      });
      return;
    }

    const { items } = req.body;

    // Validate items
    if (!Array.isArray(items)) {
      res.status(400).json({
        success: false,
        message: 'Items must be an array',
      });
      return;
    }

    // Verify all menu items exist and belong to this restaurant
    const menuItemIds = items.map((item: any) => item.menuItemId);
    const menuItems = await MenuItem.find({
      _id: { $in: menuItemIds },
      restaurantId: req.restaurantId,
      isAvailable: true,
    }).lean();

    if (menuItems.length !== menuItemIds.length) {
      res.status(400).json({
        success: false,
        message: 'One or more menu items are invalid or unavailable',
      });
      return;
    }

    // Create menu item lookup map
    const menuItemMap = new Map(menuItems.map(item => [item._id.toString(), item]));

    // Validate and enrich cart items
    const validatedItems = items.map((item: any) => {
      const menuItem = menuItemMap.get(item.menuItemId.toString());
      if (!menuItem) {
        throw new Error(`Menu item ${item.menuItemId} not found`);
      }

      return {
        menuItemId: item.menuItemId,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity || 1,
        customizations: item.customizations || [],
        specialInstructions: item.specialInstructions || '',
        addedAt: item.addedAt || new Date(),
      };
    });

    // Update or create cart
    const cart = await CustomerCart.findOneAndUpdate(
      {
        customerId,
        restaurantId: req.restaurantId,
      },
      {
        items: validatedItems,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    )
      .populate('items.menuItemId', 'name price isAvailable')
      .lean()
      .exec();

    res.status(200).json({
      success: true,
      message: 'Cart saved successfully',
      data: cart,
    });
  } catch (error: any) {
    console.error('Save cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Add item to cart
// @route   POST /api/customers/cart/items
// @access  Private (Customer)
export const addItemToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.customer?._id;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: 'Customer authentication required',
      });
      return;
    }

    const { menuItemId, quantity, customizations, specialInstructions } = req.body;

    // Verify menu item exists and belongs to this restaurant
    const menuItem = await MenuItem.findOne({
      _id: menuItemId,
      restaurantId: req.restaurantId,
      isAvailable: true,
    }).lean();

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: 'Menu item not found or unavailable',
      });
      return;
    }

    // Find or create cart
    let cart = await CustomerCart.findOne({
      customerId,
      restaurantId: req.restaurantId,
    });

    if (!cart) {
      cart = new CustomerCart({
        customerId,
        restaurantId: req.restaurantId,
        items: [],
      });
    }

    // Add item to cart
    cart.items.push({
      menuItemId,
      name: menuItem.name,
      price: menuItem.price,
      quantity: quantity || 1,
      customizations: customizations || [],
      specialInstructions: specialInstructions || '',
      addedAt: new Date(),
    } as any);

    await cart.save();

    const populatedCart = await CustomerCart.findById(cart._id)
      .populate('items.menuItemId', 'name price isAvailable')
      .lean()
      .exec();

    res.status(200).json({
      success: true,
      message: 'Item added to cart',
      data: populatedCart,
    });
  } catch (error: any) {
    console.error('Add item to cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update cart item quantity
// @route   PATCH /api/customers/cart/items/:index
// @access  Private (Customer)
export const updateCartItemQuantity = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.customer?._id;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: 'Customer authentication required',
      });
      return;
    }

    const { index } = req.params;
    const { quantity } = req.body;
    const itemIndex = parseInt(index, 10);

    if (isNaN(itemIndex) || itemIndex < 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid item index',
      });
      return;
    }

    if (!quantity || quantity < 1) {
      res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1',
      });
      return;
    }

    const cart = await CustomerCart.findOne({
      customerId,
      restaurantId: req.restaurantId,
    });

    if (!cart) {
      res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
      return;
    }

    if (itemIndex >= cart.items.length) {
      res.status(404).json({
        success: false,
        message: 'Cart item not found',
      });
      return;
    }

    cart.items[itemIndex].quantity = quantity;
    await cart.save();

    const populatedCart = await CustomerCart.findById(cart._id)
      .populate('items.menuItemId', 'name price isAvailable')
      .lean()
      .exec();

    res.status(200).json({
      success: true,
      message: 'Cart item updated',
      data: populatedCart,
    });
  } catch (error: any) {
    console.error('Update cart item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/customers/cart/items/:index
// @access  Private (Customer)
export const removeItemFromCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.customer?._id;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: 'Customer authentication required',
      });
      return;
    }

    const { index } = req.params;
    const itemIndex = parseInt(index, 10);

    if (isNaN(itemIndex) || itemIndex < 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid item index',
      });
      return;
    }

    const cart = await CustomerCart.findOne({
      customerId,
      restaurantId: req.restaurantId,
    });

    if (!cart) {
      res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
      return;
    }

    if (itemIndex >= cart.items.length) {
      res.status(404).json({
        success: false,
        message: 'Cart item not found',
      });
      return;
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();

    const populatedCart = await CustomerCart.findById(cart._id)
      .populate('items.menuItemId', 'name price isAvailable')
      .lean()
      .exec();

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: populatedCart,
    });
  } catch (error: any) {
    console.error('Remove item from cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Clear customer's cart
// @route   DELETE /api/customers/cart
// @access  Private (Customer)
export const clearCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.customer?._id;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: 'Customer authentication required',
      });
      return;
    }

    // Clear cart items
    await CustomerCart.findOneAndUpdate(
      {
        customerId,
        restaurantId: req.restaurantId,
      },
      {
        items: [],
      },
      {
        new: true,
      }
    );

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
    });
  } catch (error: any) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
