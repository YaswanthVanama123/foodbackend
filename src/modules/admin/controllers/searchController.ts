import { Request, Response } from 'express';
import Order from '../../common/models/Order';
import MenuItem from '../../common/models/MenuItem';

// @desc    Search menu items (tenant-scoped)
// @route   GET /api/search/menu
// @access  Public
export const searchMenuItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, category, dietary, minPrice, maxPrice, available } = req.query;

    if (!q || (q as string).trim().length < 2) {
      res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters',
      });
      return;
    }

    // CRITICAL: Filter by restaurant
    const filter: any = {
      restaurantId: req.restaurantId,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ],
    };

    if (category) {
      filter.categoryId = category;
    }

    if (dietary) {
      const dietaryArray = (dietary as string).split(',');
      dietaryArray.forEach((d) => {
        if (d === 'vegetarian') filter.isVegetarian = true;
        if (d === 'vegan') filter.isVegan = true;
        if (d === 'glutenFree') filter.isGlutenFree = true;
      });
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (available === 'true') {
      filter.isAvailable = true;
    }

    const items = await MenuItem.find(filter)
      .populate('categoryId', 'name')
      .select('name description price image isAvailable isVegetarian isVegan isGlutenFree')
      .limit(50)
      .lean()
      .exec();

    res.status(200).json({
      success: true,
      query: q,
      count: items.length,
      data: items,
    });
  } catch (error: any) {
    console.error('Search menu items error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Search orders (tenant-scoped)
// @route   GET /api/search/orders
// @access  Private (Admin)
export const searchOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, status, startDate, endDate } = req.query;

    if (!q || (q as string).trim().length < 2) {
      res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters',
      });
      return;
    }

    // CRITICAL: Filter by restaurant
    const filter: any = {
      restaurantId: req.restaurantId,
      $or: [
        { orderNumber: { $regex: q, $options: 'i' } },
        { tableNumber: { $regex: q, $options: 'i' } },
        { notes: { $regex: q, $options: 'i' } },
      ],
    };

    if (status) {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const orders = await Order.find(filter)
      .populate('tableId', 'tableNumber location')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .exec();

    res.status(200).json({
      success: true,
      query: q,
      count: orders.length,
      data: orders,
    });
  } catch (error: any) {
    console.error('Search orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get filtered menu items with advanced options (tenant-scoped)
// @route   GET /api/search/menu/filter
// @access  Public
export const filterMenuItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      category,
      dietary,
      minPrice,
      maxPrice,
      available,
      sort,
      page = 1,
      limit = 20,
    } = req.query;

    // CRITICAL: Filter by restaurant
    const filter: any = {
      restaurantId: req.restaurantId,
    };

    if (category) {
      filter.categoryId = category;
    }

    if (dietary) {
      const dietaryArray = (dietary as string).split(',');
      dietaryArray.forEach((d) => {
        if (d === 'vegetarian') filter.isVegetarian = true;
        if (d === 'vegan') filter.isVegan = true;
        if (d === 'glutenFree') filter.isGlutenFree = true;
      });
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (available === 'true') {
      filter.isAvailable = true;
    }

    let sortOption: any = { name: 1 };
    if (sort === 'price_asc') sortOption = { price: 1 };
    if (sort === 'price_desc') sortOption = { price: -1 };
    if (sort === 'name_asc') sortOption = { name: 1 };
    if (sort === 'name_desc') sortOption = { name: -1 };
    if (sort === 'popular') sortOption = { createdAt: -1 }; // Placeholder for popularity

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      MenuItem.find(filter)
        .populate('categoryId', 'name')
        .sort(sortOption)
        .skip(skip)
        .limit(Number(limit))
        .lean()
        .exec(),
      MenuItem.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: items.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: items,
    });
  } catch (error: any) {
    console.error('Filter menu items error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get dietary filter options (tenant-scoped)
// @route   GET /api/search/dietary-options
// @access  Public
export const getDietaryOptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const [vegetarianCount, veganCount, glutenFreeCount] = await Promise.all([
      MenuItem.countDocuments({
        restaurantId: req.restaurantId,
        isVegetarian: true,
        isAvailable: true
      }),
      MenuItem.countDocuments({
        restaurantId: req.restaurantId,
        isVegan: true,
        isAvailable: true
      }),
      MenuItem.countDocuments({
        restaurantId: req.restaurantId,
        isGlutenFree: true,
        isAvailable: true
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        options: [
          {
            value: 'vegetarian',
            label: 'Vegetarian',
            count: vegetarianCount,
          },
          {
            value: 'vegan',
            label: 'Vegan',
            count: veganCount,
          },
          {
            value: 'glutenFree',
            label: 'Gluten Free',
            count: glutenFreeCount,
          },
        ],
      },
    });
  } catch (error: any) {
    console.error('Get dietary options error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get price range for menu items (tenant-scoped)
// @route   GET /api/search/price-range
// @access  Public
export const getPriceRange = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await MenuItem.aggregate([
      { $match: { restaurantId: req.restaurantId, isAvailable: true } },
      {
        $group: {
          _id: null,
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          avgPrice: { $avg: '$price' },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: result[0] || { minPrice: 0, maxPrice: 0, avgPrice: 0 },
    });
  } catch (error: any) {
    console.error('Get price range error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
