const express = require('express');
const router = express.Router();
const bookingCtrl = require('../controllers/bookingController');
// const auth = require('../middleware/auth');

// ==================== PUBLIC ROUTES ====================
// These routes don't require authentication - for public booking form

/**
 * @route   GET /api/bookings/slots
 * @desc    Get booked time slots for a specific date
 * @query   date (required) - Format: YYYY-MM-DD
 * @access  Public
 */
router.get('/slots', bookingCtrl.getBookedSlots);

/**
 * @route   POST /api/bookings
 * @desc    Create a new booking (public - no login required)
 * @body    { name, phone, email, service, date, timeSlot, notes, price }
 * @access  Public
 */
router.post('/', bookingCtrl.createBooking);

// ==================== ADMIN ROUTES ====================
// IMPORTANT: All specific routes (like /all, /my-bookings) MUST come BEFORE /:id
// Otherwise Express will treat them as ID parameters

/**
 * @route   GET /api/bookings/all
 * @desc    Get all bookings (with pagination and filters)
 * @query   page, limit, date, status
 * @access  Private (Admin)
 */
router.get('/all', bookingCtrl.getAllBookings);

// ==================== PROTECTED ROUTES (USER) ====================
// These routes require authentication

/**
 * @route   GET /api/bookings/my-bookings
 * @desc    Get current user's bookings
 * @access  Private
 */
router.get('/my-bookings', bookingCtrl.getMyBookings);

/**
 * @route   PATCH /api/bookings/:id/cancel
 * @desc    Cancel a booking
 * @params  id
 * @access  Private
 */
router.patch('/:id/cancel', bookingCtrl.cancelBooking);

// ==================== DYNAMIC ROUTES ====================
// IMPORTANT: These MUST come LAST because they match any path

/**
 * @route   GET /api/bookings/:id
 * @desc    Get single booking by ID
 * @params  id
 * @access  Private
 */
router.get('/:id', bookingCtrl.getBookingById);

/**
 * @route   PATCH /api/bookings/:id
 * @desc    Update booking status
 * @params  id
 * @body    { status }
 * @access  Private (Admin)
 */
router.patch('/:id', bookingCtrl.updateBooking);

/**
 * @route   DELETE /api/bookings/:id
 * @desc    Delete a booking
 * @params  id
 * @access  Private (Admin)
 */
router.delete('/:id', bookingCtrl.deleteBooking);

module.exports = router;