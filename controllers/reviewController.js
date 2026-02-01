const Review = require('../models/Review');

// @route   GET /api/reviews
// @desc    Get all approved reviews (public)
// @access  Public
exports.getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ approved: true })
      .sort({ createdAt: -1 })
      .select('-__v');
    
    res.status(200).json({
      success: true,
      count: reviews.length,
      reviews: reviews
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews',
      error: error.message
    });
  }
};

// @route   GET /api/reviews/all
// @desc    Get all reviews including pending (admin)
// @access  Private (Admin)
exports.getAllReviewsAdmin = async (req, res) => {
  try {
    const reviews = await Review.find()
      .sort({ createdAt: -1 })
      .select('-__v');
    
    res.status(200).json({
      success: true,
      count: reviews.length,
      reviews: reviews
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews',
      error: error.message
    });
  }
};

// @route   POST /api/reviews
// @desc    Create a new review
// @access  Public
exports.createReview = async (req, res) => {
  try {
    const { name, rating, comment, service, email } = req.body;

    // Validation
    if (!name || !rating || !comment || !service) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, rating, comment, and service'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const review = await Review.create({
      name,
      rating,
      comment,
      service,
      email,
      approved: false, // Reviews need admin approval
      verified: false,
      createdAt: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully. It will be visible after approval.',
      review: review
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create review',
      error: error.message
    });
  }
};

// @route   PUT /api/reviews/:id/approve
// @desc    Approve a review
// @access  Private (Admin)
exports.approveReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    review.approved = true;
    await review.save();

    res.status(200).json({
      success: true,
      message: 'Review approved successfully',
      review: review
    });
  } catch (error) {
    console.error('Error approving review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve review',
      error: error.message
    });
  }
};

// @route   DELETE /api/reviews/:id
// @desc    Delete a review
// @access  Private (Admin)
exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    await review.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete review',
      error: error.message
    });
  }
};