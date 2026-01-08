import express from 'express';
import {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket,
  addMessage,
  assignTicket,
  updateStatus,
  resolveTicket,
  getTicketStatistics,
  deleteTicket,
} from '../controllers/ticketController';
import { superAdminAuth } from '../../common/middleware/authMiddleware';

const router = express.Router();

/**
 * Ticket Routes
 * Base path: /api/superadmin/tickets
 * All routes require super admin authentication
 */

// Get ticket statistics
router.get('/stats', superAdminAuth, getTicketStatistics);

// Get all tickets with filtering and pagination
router.get('/', superAdminAuth, getAllTickets);

// Get ticket by ID
router.get('/:id', superAdminAuth, getTicketById);

// Create new ticket
router.post('/', superAdminAuth, createTicket);

// Update ticket details
router.put('/:id', superAdminAuth, updateTicket);

// Add message to ticket
router.post('/:id/messages', superAdminAuth, addMessage);

// Assign ticket to super admin
router.patch('/:id/assign', superAdminAuth, assignTicket);

// Update ticket status
router.patch('/:id/status', superAdminAuth, updateStatus);

// Resolve ticket
router.post('/:id/resolve', superAdminAuth, resolveTicket);

// Delete ticket
router.delete('/:id', superAdminAuth, deleteTicket);

export default router;
