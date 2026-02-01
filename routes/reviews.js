const express = require('express');
const router = express.Router();
const reviewCtrl = require('../controllers/reviewController');
const auth = require('../middleware/auth');

// ==================== PUBLIC ROUTES ====================

/**
 * @route   GET /api/reviews
 * @desc    Get all approved reviews (for public display)
 * @access  Public
 */
router.get('/', reviewCtrl.getAllReviews);

/**
 * @route   POST /api/reviews
 * @desc    Create a new review
 * @body    { name, rating, comment, service, email }
 * @access  Public
 */
router.post('/', reviewCtrl.createReview);

// ==================== ADMIN ROUTES ====================

/**
 * @route   GET /api/reviews/all
 * @desc    Get all reviews including pending (for admin)
 * @access  Private (Admin)
 */
router.get('/all',  reviewCtrl.getAllReviewsAdmin);

/**
 * @route   PUT /api/reviews/:id/approve
 * @desc    Approve a review
 * @params  id
 * @access  Private (Admin)
 */
router.put('/:id/approve',  reviewCtrl.approveReview);

/**
 * @route   DELETE /api/reviews/:id
 * @desc    Delete a review
 * @params  id
 * @access  Private (Admin)
 */
router.delete('/:id', reviewCtrl.deleteReview);

module.exports = router;