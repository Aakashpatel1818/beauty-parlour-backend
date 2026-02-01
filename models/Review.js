const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide your name'],
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  rating: {
    type: Number,
    required: [true, 'Please provide a rating'],
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: [true, 'Please provide a comment'],
    trim: true,
    maxlength: [500, 'Comment cannot exceed 500 characters']
  },
  service: {
    type: String,
    required: [true, 'Please specify the service'],
    trim: true
  },
  approved: {
    type: Boolean,
    default: false
  },
  verified: {
    type: Boolean,
    default: false
  },
  reviewImage: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for better query performance
reviewSchema.index({ approved: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);