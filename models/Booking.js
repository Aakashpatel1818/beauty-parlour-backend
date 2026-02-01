// models/Booking.js

const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // User Information (for public bookings without login)
  name: { 
    type: String, 
    required: true,
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [100, 'Name must not exceed 100 characters']
  },
  phone: { 
    type: String, 
    required: true,
    trim: true,
    match: [/^[0-9]{10}$/, 'Phone number must be 10 digits']
  },
  email: { 
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  
  // Service Information
  service: {
    type: String,
    required: true,
    trim: true
  },
  serviceId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Service'
  },
  
  // Booking Details
  date: { 
    type: Date, 
    required: true,
    validate: {
      validator: function(value) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return value >= today;
      },
      message: 'Booking date cannot be in the past'
    }
  },
  time: { 
    type: String, 
    required: true,
    match: [/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (use HH:MM)']
  },
  timeSlot: { 
    type: String,
    match: [/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time slot format (use HH:MM)']
  },
  
  // Status
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'cancelled', 'completed'], 
    default: 'confirmed'
  },
  
  // Additional Information
  notes: { 
    type: String,
    maxlength: [500, 'Notes must not exceed 500 characters']
  },
  
  // User Reference (optional - for logged in users)
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  }
}, { 
  timestamps: true 
});

// Indexes for better query performance
bookingSchema.index({ date: 1, time: 1 }, { unique: true }); // Prevent double booking
bookingSchema.index({ date: 1, timeSlot: 1 }); // For timeSlot queries
bookingSchema.index({ date: 1, userId: 1 });
bookingSchema.index({ phone: 1 }); // For phone number queries
bookingSchema.index({ status: 1 });
bookingSchema.index({ userId: 1 });

// Virtual to ensure timeSlot and time are synced
bookingSchema.pre('save', function(next) {
  if (this.time && !this.timeSlot) {
    this.timeSlot = this.time;
  } else if (this.timeSlot && !this.time) {
    this.time = this.timeSlot;
  }
  next();
});

// Instance method to format booking details
bookingSchema.methods.getFormattedDetails = function() {
  return {
    id: this._id,
    name: this.name,
    phone: this.phone,
    email: this.email,
    service: this.service,
    serviceId: this.serviceId,
    date: this.date.toISOString().split('T')[0],
    time: this.time,
    timeSlot: this.timeSlot || this.time,
    status: this.status,
    notes: this.notes,
    userId: this.userId,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Static method to check if a slot is available
bookingSchema.statics.isSlotAvailable = async function(date, timeSlot) {
  const booking = await this.findOne({ 
    date, 
    $or: [
      { time: timeSlot },
      { timeSlot: timeSlot }
    ],
    status: { $ne: 'cancelled' }
  });
  return !booking;
};

// Static method to get booked slots for a date
bookingSchema.statics.getBookedSlots = async function(date) {
  const bookings = await this.find({ 
    date,
    status: { $ne: 'cancelled' }
  }).select('time timeSlot -_id');
  
  return bookings.map(booking => booking.timeSlot || booking.time);
};

module.exports = mongoose.model('Booking', bookingSchema);