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

const router = express.Router();

/**
 * Ticket Routes
 * Base path: /api/superadmin/tickets
 */

// Get ticket statistics
router.get('/stats', getTicketStatistics);

// Get all tickets with filtering and pagination
router.get('/', getAllTickets);

// Get ticket by ID
router.get('/:id', getTicketById);

// Create new ticket
router.post('/', createTicket);

// Update ticket details
router.put('/:id', updateTicket);

// Add message to ticket
router.post('/:id/messages', addMessage);

// Assign ticket to super admin
router.patch('/:id/assign', assignTicket);

// Update ticket status
router.patch('/:id/status', updateStatus);

// Resolve ticket
router.post('/:id/resolve', resolveTicket);

// Delete ticket
router.delete('/:id', deleteTicket);

export default router;
