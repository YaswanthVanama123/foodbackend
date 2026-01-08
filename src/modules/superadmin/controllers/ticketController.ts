import { Request, Response } from 'express';
import Ticket from '../../common/models/Ticket';
import Restaurant from '../../common/models/Restaurant';
import SuperAdmin from '../../common/models/SuperAdmin';
import { Types } from 'mongoose';

/**
 * Get all tickets with filtering and pagination
 * GET /api/superadmin/tickets
 */
export const getAllTickets = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      status,
      priority,
      category,
      restaurantId,
      assignedTo,
      search,
      tags,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Build filter object
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    if (priority) {
      filter.priority = priority;
    }

    if (category) {
      filter.category = category;
    }

    if (restaurantId) {
      filter.restaurantId = restaurantId;
    }

    if (assignedTo) {
      if (assignedTo === 'unassigned') {
        filter.assignedTo = { $exists: false };
      } else {
        filter.assignedTo = assignedTo;
      }
    }

    if (tags) {
      const tagArray = typeof tags === 'string' ? tags.split(',') : tags;
      filter.tags = { $in: tagArray };
    }

    // Add search functionality
    if (search) {
      filter.$or = [
        { ticketNumber: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { restaurantName: { $regex: search, $options: 'i' } },
      ];
    }

    // Calculate pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const tickets = await Ticket.find(filter)
      .populate('restaurantId', 'name subdomain email phone')
      .populate('assignedTo', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for pagination
    const totalTickets = await Ticket.countDocuments(filter);
    const totalPages = Math.ceil(totalTickets / limitNum);

    // Get statistics
    const statusCounts = await Ticket.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const priorityCounts = await Ticket.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]);

    res.status(200).json({
      success: true,
      message: 'Tickets retrieved successfully',
      data: {
        tickets,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalTickets,
          limit: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
        statistics: {
          byStatus: statusCounts.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          byPriority: priorityCounts.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tickets',
      error: error.message,
    });
  }
};

/**
 * Get ticket by ID with full details and messages
 * GET /api/superadmin/tickets/:id
 */
export const getTicketById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid ticket ID',
      });
      return;
    }

    const ticket = await Ticket.findById(id)
      .populate('restaurantId', 'name subdomain email phone address')
      .populate('assignedTo', 'firstName lastName email')
      .lean();

    if (!ticket) {
      res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Ticket retrieved successfully',
      data: ticket,
    });
  } catch (error: any) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ticket',
      error: error.message,
    });
  }
};

/**
 * Create a new ticket
 * POST /api/superadmin/tickets
 */
export const createTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      restaurantId,
      restaurantName,
      title,
      description,
      category,
      priority = 'medium',
      tags = [],
    } = req.body;

    // Validation
    if (!title || !description || !category || !restaurantName) {
      res.status(400).json({
        success: false,
        message: 'Title, description, category, and restaurant name are required',
      });
      return;
    }

    // Validate restaurant if ID provided
    if (restaurantId) {
      if (!Types.ObjectId.isValid(restaurantId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid restaurant ID',
        });
        return;
      }

      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant) {
        res.status(404).json({
          success: false,
          message: 'Restaurant not found',
        });
        return;
      }
    }

    // Create ticket
    const ticket = await Ticket.create({
      restaurantId: restaurantId || undefined,
      restaurantName,
      title,
      description,
      category,
      priority,
      tags,
      messages: [
        {
          sender: 'system',
          senderName: 'System',
          message: `Ticket created: ${title}`,
          timestamp: new Date(),
        },
      ],
    });

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('restaurantId', 'name subdomain email phone')
      .lean();

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      data: populatedTicket,
    });
  } catch (error: any) {
    console.error('Error creating ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating ticket',
      error: error.message,
    });
  }
};

/**
 * Update ticket details
 * PUT /api/superadmin/tickets/:id
 */
export const updateTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      category,
      priority,
      tags,
    } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid ticket ID',
      });
      return;
    }

    const ticket = await Ticket.findById(id);

    if (!ticket) {
      res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
      return;
    }

    // Update fields if provided
    if (title) ticket.title = title;
    if (description) ticket.description = description;
    if (category) ticket.category = category;
    if (priority) ticket.priority = priority;
    if (tags) ticket.tags = tags;

    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate('restaurantId', 'name subdomain email phone')
      .populate('assignedTo', 'firstName lastName email')
      .lean();

    res.status(200).json({
      success: true,
      message: 'Ticket updated successfully',
      data: updatedTicket,
    });
  } catch (error: any) {
    console.error('Error updating ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating ticket',
      error: error.message,
    });
  }
};

/**
 * Add a message to a ticket
 * POST /api/superadmin/tickets/:id/messages
 */
export const addMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      sender,
      senderName,
      senderId,
      message,
      attachments = [],
      isInternal = false,
    } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid ticket ID',
      });
      return;
    }

    if (!sender || !senderName || !message) {
      res.status(400).json({
        success: false,
        message: 'Sender, sender name, and message are required',
      });
      return;
    }

    const ticket = await Ticket.findById(id);

    if (!ticket) {
      res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
      return;
    }

    // Validate sender ID if provided
    if (senderId && !Types.ObjectId.isValid(senderId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid sender ID',
      });
      return;
    }

    // Add message to ticket
    ticket.messages.push({
      sender,
      senderName,
      senderId: senderId ? new Types.ObjectId(senderId) : undefined,
      message,
      timestamp: new Date(),
      attachments,
      isInternal,
    });

    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate('restaurantId', 'name subdomain email phone')
      .populate('assignedTo', 'firstName lastName email')
      .lean();

    res.status(200).json({
      success: true,
      message: 'Message added successfully',
      data: updatedTicket,
    });
  } catch (error: any) {
    console.error('Error adding message:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding message',
      error: error.message,
    });
  }
};

/**
 * Assign ticket to a super admin
 * PATCH /api/superadmin/tickets/:id/assign
 */
export const assignTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid ticket ID',
      });
      return;
    }

    const ticket = await Ticket.findById(id);

    if (!ticket) {
      res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
      return;
    }

    // If unassigning
    if (!assignedTo) {
      ticket.assignedTo = undefined;
      ticket.assignedToName = undefined;

      ticket.messages.push({
        sender: 'system',
        senderName: 'System',
        message: 'Ticket unassigned',
        timestamp: new Date(),
      });

      await ticket.save();

      const updatedTicket = await Ticket.findById(ticket._id)
        .populate('restaurantId', 'name subdomain email phone')
        .lean();

      res.status(200).json({
        success: true,
        message: 'Ticket unassigned successfully',
        data: updatedTicket,
      });
      return;
    }

    // Validate super admin
    if (!Types.ObjectId.isValid(assignedTo)) {
      res.status(400).json({
        success: false,
        message: 'Invalid super admin ID',
      });
      return;
    }

    const superAdmin = await SuperAdmin.findById(assignedTo);

    if (!superAdmin) {
      res.status(404).json({
        success: false,
        message: 'Super admin not found',
      });
      return;
    }

    // Assign ticket
    ticket.assignedTo = new Types.ObjectId(assignedTo);
    ticket.assignedToName = `${superAdmin.firstName} ${superAdmin.lastName}`;

    // Add system message
    ticket.messages.push({
      sender: 'system',
      senderName: 'System',
      message: `Ticket assigned to ${superAdmin.firstName} ${superAdmin.lastName}`,
      timestamp: new Date(),
    });

    // Update status to in_progress if it was open
    if (ticket.status === 'open') {
      ticket.status = 'in_progress';
    }

    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate('restaurantId', 'name subdomain email phone')
      .populate('assignedTo', 'firstName lastName email')
      .lean();

    res.status(200).json({
      success: true,
      message: 'Ticket assigned successfully',
      data: updatedTicket,
    });
  } catch (error: any) {
    console.error('Error assigning ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning ticket',
      error: error.message,
    });
  }
};

/**
 * Update ticket status
 * PATCH /api/superadmin/tickets/:id/status
 */
export const updateStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid ticket ID',
      });
      return;
    }

    if (!status) {
      res.status(400).json({
        success: false,
        message: 'Status is required',
      });
      return;
    }

    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: open, in_progress, resolved, closed',
      });
      return;
    }

    const ticket = await Ticket.findById(id);

    if (!ticket) {
      res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
      return;
    }

    const oldStatus = ticket.status;
    ticket.status = status;

    // Add system message about status change
    ticket.messages.push({
      sender: 'system',
      senderName: 'System',
      message: `Status changed from ${oldStatus} to ${status}${note ? `: ${note}` : ''}`,
      timestamp: new Date(),
    });

    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate('restaurantId', 'name subdomain email phone')
      .populate('assignedTo', 'firstName lastName email')
      .lean();

    res.status(200).json({
      success: true,
      message: 'Ticket status updated successfully',
      data: updatedTicket,
    });
  } catch (error: any) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating ticket status',
      error: error.message,
    });
  }
};

/**
 * Resolve a ticket
 * POST /api/superadmin/tickets/:id/resolve
 */
export const resolveTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { resolutionNote } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid ticket ID',
      });
      return;
    }

    const ticket = await Ticket.findById(id);

    if (!ticket) {
      res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
      return;
    }

    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      res.status(400).json({
        success: false,
        message: 'Ticket is already resolved or closed',
      });
      return;
    }

    ticket.status = 'resolved';
    ticket.resolvedAt = new Date();

    // Add resolution message
    ticket.messages.push({
      sender: 'system',
      senderName: 'System',
      message: `Ticket resolved${resolutionNote ? `: ${resolutionNote}` : ''}`,
      timestamp: new Date(),
    });

    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate('restaurantId', 'name subdomain email phone')
      .populate('assignedTo', 'firstName lastName email')
      .lean();

    res.status(200).json({
      success: true,
      message: 'Ticket resolved successfully',
      data: updatedTicket,
    });
  } catch (error: any) {
    console.error('Error resolving ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Error resolving ticket',
      error: error.message,
    });
  }
};

/**
 * Get ticket statistics
 * GET /api/superadmin/tickets/stats
 */
export const getTicketStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId, startDate, endDate } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate as string);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate as string);
    }

    // Build restaurant filter
    const restaurantFilter: any = {};
    if (restaurantId) {
      restaurantFilter.restaurantId = restaurantId;
    }

    const filter = { ...dateFilter, ...restaurantFilter };

    // Get comprehensive statistics
    const stats = await Ticket.aggregate([
      { $match: filter },
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                open: {
                  $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] },
                },
                inProgress: {
                  $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] },
                },
                resolved: {
                  $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] },
                },
                closed: {
                  $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] },
                },
              },
            },
          ],
          byPriority: [
            { $group: { _id: '$priority', count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
          byCategory: [
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          byRestaurant: [
            {
              $group: {
                _id: '$restaurantId',
                restaurantName: { $first: '$restaurantName' },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
          recentActivity: [
            { $sort: { createdAt: -1 } },
            { $limit: 10 },
            {
              $project: {
                ticketNumber: 1,
                title: 1,
                status: 1,
                priority: 1,
                category: 1,
                createdAt: 1,
              },
            },
          ],
        },
      },
    ]);

    res.status(200).json({
      success: true,
      message: 'Statistics retrieved successfully',
      data: stats[0],
    });
  } catch (error: any) {
    console.error('Error fetching ticket statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message,
    });
  }
};

/**
 * Delete a ticket
 * DELETE /api/superadmin/tickets/:id
 */
export const deleteTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid ticket ID',
      });
      return;
    }

    const ticket = await Ticket.findByIdAndDelete(id);

    if (!ticket) {
      res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Ticket deleted successfully',
      data: { ticketNumber: ticket.ticketNumber },
    });
  } catch (error: any) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting ticket',
      error: error.message,
    });
  }
};
