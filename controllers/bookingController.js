// controllers/bookingController.js

const Booking = require('../models/Booking');
const TimeSlot = require('../models/TimeSlot');
const Joi = require('joi');

// Initialize Twilio only if credentials are available
let twilio;
if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
  twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
}

// Validation schemas
const bookingSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
  email: Joi.string().email().optional().allow(''),
  service: Joi.string().required(),
  serviceId: Joi.string().optional(),
  date: Joi.date().min('now').required(),
  timeSlot: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  time: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  notes: Joi.string().max(500).optional().allow(''),
  status: Joi.string().valid('pending', 'confirmed', 'cancelled', 'completed').optional()
}).or('timeSlot', 'time');

const updateBookingSchema = Joi.object({
  status: Joi.string().valid('pending', 'confirmed', 'cancelled', 'completed').required(),
  notes: Joi.string().max(500).optional().allow('')
});

/**
 * Get booked time slots for a specific date
 * @route GET /api/bookings/slots?date=YYYY-MM-DD
 */
exports.getBookedSlots = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required (format: YYYY-MM-DD)'
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    const queryDate = new Date(date + 'T00:00:00.000Z');

    if (isNaN(queryDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date'
      });
    }

    // Create date range for the entire day
    const startOfDay = new Date(queryDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(queryDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Get booked slots from Booking model
    const bookings = await Booking.find({ 
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: 'cancelled' }
    }).select('timeSlot time -_id');

    const bookedSlots = bookings
      .map(b => b.timeSlot || b.time)
      .filter(slot => slot);

    res.status(200).json({
      success: true,
      date: date,
      bookedSlots: [...new Set(bookedSlots)]
    });

  } catch (error) {
    console.error('Error fetching booked slots:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booked slots',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Format date for WhatsApp message
 * @param {Date} date 
 * @returns {string} Formatted date like "Wed Jan 28 2026"
 */
const formatDateForWhatsApp = (date) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const dayName = days[date.getDay()];
  const monthName = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  
  return `${dayName} ${monthName} ${day} ${year}`;
};

/**
 * Create a new booking
 * @route POST /api/bookings
 */
exports.createBooking = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = bookingSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    let { name, phone, email, service, serviceId, date, timeSlot, time, notes, status } = value;

    // Handle both 'timeSlot' and 'time' field names
    const selectedTime = timeSlot || time;
    
    if (!selectedTime) {
      return res.status(400).json({
        success: false,
        message: 'Time slot is required'
      });
    }

    // Convert date string to Date object and normalize to start of day
    const bookingDate = new Date(date);
    bookingDate.setUTCHours(0, 0, 0, 0);

    // Validate booking is not in the past
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (bookingDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Cannot book appointments in the past'
      });
    }

    // Check if slot is available in TimeSlot model (if it exists)
    try {
      const slotDoc = await TimeSlot.findOne({ date: bookingDate });
      if (slotDoc) {
        const slot = slotDoc.slots.find(s => s.time === selectedTime);
        
        if (slot && !slot.available) {
          return res.status(409).json({
            success: false,
            message: 'This time slot is already booked. Please select another time.'
          });
        }
      }
    } catch (timeSlotError) {
      console.log('TimeSlot check error:', timeSlotError.message);
    }

    // Check if slot is already booked in Booking model
    const existingBooking = await Booking.findOne({
      date: bookingDate,
      $or: [
        { timeSlot: selectedTime },
        { time: selectedTime }
      ],
      status: { $ne: 'cancelled' }
    });

    if (existingBooking) {
      return res.status(409).json({
        success: false,
        message: 'This time slot is already booked. Please select another time.'
      });
    }

    // Create new booking with status from request or default to 'confirmed'
    const bookingData = {
      name: name.trim(),
      phone,
      email: email?.trim() || undefined,
      service: service.trim(),
      serviceId: serviceId || undefined,
      date: bookingDate,
      timeSlot: selectedTime,
      time: selectedTime,
      notes: notes?.trim() || undefined,
      status: status || 'confirmed' // Default to confirmed if not provided
    };

    const booking = new Booking(bookingData);
    await booking.save();

    // Update TimeSlot model if it exists
    try {
      await TimeSlot.updateOne(
        { date: bookingDate, 'slots.time': selectedTime },
        { 
          $set: { 
            'slots.$.available': false, 
            'slots.$.bookedBy': booking._id 
          } 
        }
      );
    } catch (timeSlotError) {
      console.log('TimeSlot update error:', timeSlotError.message);
    }

    // Send WhatsApp confirmation if Twilio is configured
    if (twilio && process.env.TWILIO_WHATSAPP_FROM) {
      try {
        // Format date like "Wed Jan 28 2026"
        const formattedDate = formatDateForWhatsApp(bookingDate);
        
        // Create message in the exact format requested
        const message = `Hi ${name}! Your booking for ${service} on ${formattedDate} at ${selectedTime} is confirmed! - Luxe Beauty Studio`;
        
        await twilio.messages.create({
          body: message,
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
          to: `whatsapp:+91${phone}`
        });
        
        console.log('✅ WhatsApp confirmation sent successfully to', phone);
      } catch (twilioError) {
        console.error('❌ Twilio error:', twilioError.message);
        // Don't fail the booking if WhatsApp fails
      }
    } else {
      console.log('⚠️  Twilio not configured - WhatsApp message not sent');
    }

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking: {
        id: booking._id,
        name: booking.name,
        phone: booking.phone,
        email: booking.email,
        service: booking.service,
        date: booking.date.toISOString().split('T')[0],
        timeSlot: selectedTime,
        status: booking.status,
        notes: booking.notes,
        createdAt: booking.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating booking:', error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This time slot is already booked. Please select another time.'
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get user's bookings
 * @route GET /api/bookings/my-bookings
 */
exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({})
      .populate('serviceId', 'name duration')
      .sort({ date: -1, timeSlot: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings: bookings.map(b => ({
        id: b._id,
        name: b.name,
        phone: b.phone,
        email: b.email,
        service: b.service,
        serviceDetails: b.serviceId,
        date: b.date.toISOString().split('T')[0],
        timeSlot: b.timeSlot || b.time,
        status: b.status,
        notes: b.notes,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt
      }))
    });

  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all bookings (Admin)
 * @route GET /api/bookings/all
 */
exports.getAllBookings = async (req, res) => {
  try {
    console.log('getAllBookings called');
    const { page = 1, limit = 50, date, status, search } = req.query;

    const query = {};
    
    // Filter by date
    if (date) {
      const queryDate = new Date(date + 'T00:00:00.000Z');
      if (!isNaN(queryDate.getTime())) {
        const startOfDay = new Date(queryDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(queryDate);
        endOfDay.setUTCHours(23, 59, 59, 999);
        query.date = { $gte: startOfDay, $lte: endOfDay };
      }
    }
    
    // Filter by status
    if (status) {
      query.status = status;
    }

    // Search by name, phone, or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const bookings = await Booking.find(query)
      .populate('serviceId', 'name duration')
      .populate('userId', 'name email phone')
      .sort({ date: -1, timeSlot: 1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .lean();

    const count = await Booking.countDocuments(query);

    console.log('Found bookings:', bookings.length);

    res.status(200).json({
      success: true,
      bookings: bookings.map(b => ({
        id: b._id,
        _id: b._id,
        name: b.name,
        phone: b.phone,
        email: b.email || '',
        service: b.service,
        serviceDetails: b.serviceId,
        user: b.userId,
        date: b.date.toISOString().split('T')[0],
        timeSlot: b.timeSlot || b.time,
        time: b.timeSlot || b.time,
        status: b.status,
        notes: b.notes || '',
        createdAt: b.createdAt,
        updatedAt: b.updatedAt
      })),
      totalPages: Math.ceil(count / limitNum),
      currentPage: pageNum,
      total: count
    });

  } catch (error) {
    console.error('Error fetching all bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get single booking by ID
 * @route GET /api/bookings/:id
 */
exports.getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }

    const booking = await Booking.findById(id)
      .populate('serviceId', 'name duration')
      .populate('userId', 'name email phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.status(200).json({
      success: true,
      booking: {
        id: booking._id,
        name: booking.name,
        phone: booking.phone,
        email: booking.email,
        service: booking.service,
        serviceDetails: booking.serviceId,
        user: booking.userId,
        date: booking.date.toISOString().split('T')[0],
        timeSlot: booking.timeSlot || booking.time,
        status: booking.status,
        notes: booking.notes,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt
      }
    });

  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update booking status
 * @route PATCH /api/bookings/:id
 */
exports.updateBooking = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }

    // Validate request body
    const { error, value } = updateBookingSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { status, notes } = value;

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const oldStatus = booking.status;
    booking.status = status;
    
    if (notes !== undefined) {
      booking.notes = notes;
    }
    
    await booking.save();

    // If booking is cancelled, make the slot available again
    if (status === 'cancelled' && oldStatus !== 'cancelled') {
      try {
        await TimeSlot.updateOne(
          { date: booking.date, 'slots.time': booking.timeSlot || booking.time },
          { 
            $set: { 
              'slots.$.available': true, 
              'slots.$.bookedBy': null 
            } 
          }
        );
      } catch (timeSlotError) {
        console.log('TimeSlot update error:', timeSlotError.message);
      }

      // Send cancellation WhatsApp
      if (twilio && process.env.TWILIO_WHATSAPP_FROM) {
        try {
          const formattedDate = formatDateForWhatsApp(booking.date);
          
          await twilio.messages.create({
            body: `Hi ${booking.name}! Your booking for ${booking.service} on ${formattedDate} at ${booking.timeSlot || booking.time} has been cancelled. - Luxe Beauty Studio`,
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
            to: `whatsapp:+91${booking.phone}`
          });
          
          console.log('✅ Cancellation WhatsApp sent to', booking.phone);
        } catch (twilioError) {
          console.error('❌ Twilio error:', twilioError.message);
        }
      }
    }

    // Send confirmation WhatsApp for status changes to confirmed
    if (status === 'confirmed' && oldStatus !== 'confirmed' && twilio && process.env.TWILIO_WHATSAPP_FROM) {
      try {
        const formattedDate = formatDateForWhatsApp(booking.date);
        
        await twilio.messages.create({
          body: `Hi ${booking.name}! Your booking for ${booking.service} on ${formattedDate} at ${booking.timeSlot || booking.time} is confirmed! - Luxe Beauty Studio`,
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
          to: `whatsapp:+91${booking.phone}`
        });
        
        console.log('✅ Confirmation WhatsApp sent to', booking.phone);
      } catch (twilioError) {
        console.error('❌ Twilio error:', twilioError.message);
      }
    }

    // Send completion WhatsApp notification
    if (status === 'completed' && oldStatus !== 'completed' && twilio && process.env.TWILIO_WHATSAPP_FROM) {
      try {
        const formattedDate = formatDateForWhatsApp(booking.date);
        
        await twilio.messages.create({
          body: `Hi ${booking.name}! Thank you for visiting us! Your ${booking.service} service on ${formattedDate} at ${booking.timeSlot || booking.time} is completed. We hope to see you again! - Luxe Beauty Studio`,
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
          to: `whatsapp:+91${booking.phone}`
        });
        
        console.log('✅ Completion WhatsApp sent to', booking.phone);
      } catch (twilioError) {
        console.error('❌ Twilio error:', twilioError.message);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Booking updated successfully',
      booking: {
        id: booking._id,
        name: booking.name,
        status: booking.status,
        date: booking.date.toISOString().split('T')[0],
        timeSlot: booking.timeSlot || booking.time,
        notes: booking.notes
      }
    });

  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Cancel booking
 * @route PATCH /api/bookings/:id/cancel
 */
exports.cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    // Check if booking is in the past
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    const bookingDate = new Date(booking.date);
    bookingDate.setUTCHours(0, 0, 0, 0);
    
    if (bookingDate < now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel past bookings'
      });
    }

    booking.status = 'cancelled';
    await booking.save();

    // Make slot available again
    try {
      await TimeSlot.updateOne(
        { date: booking.date, 'slots.time': booking.timeSlot || booking.time },
        { 
          $set: { 
            'slots.$.available': true, 
            'slots.$.bookedBy': null 
          } 
        }
      );
    } catch (timeSlotError) {
      console.log('TimeSlot update error:', timeSlotError.message);
    }

    // Send WhatsApp notification
    if (twilio && process.env.TWILIO_WHATSAPP_FROM) {
      try {
        const formattedDate = formatDateForWhatsApp(booking.date);
        
        await twilio.messages.create({
          body: `Hi ${booking.name}! Your booking for ${booking.service} on ${formattedDate} at ${booking.timeSlot || booking.time} has been cancelled. - Luxe Beauty Studio`,
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
          to: `whatsapp:+91${booking.phone}`
        });
        
        console.log('✅ Cancellation WhatsApp sent to', booking.phone);
      } catch (twilioError) {
        console.error('❌ Twilio error:', twilioError.message);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete booking
 * @route DELETE /api/bookings/:id
 */
exports.deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Make slot available again before deleting
    try {
      await TimeSlot.updateOne(
        { date: booking.date, 'slots.time': booking.timeSlot || booking.time },
        { 
          $set: { 
            'slots.$.available': true, 
            'slots.$.bookedBy': null 
          } 
        }
      );
    } catch (timeSlotError) {
      console.log('TimeSlot update error:', timeSlotError.message);
    }

    await Booking.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Booking deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = exports;