const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  slots: [{
    time: { type: String, required: true },
    available: { type: Boolean, default: true },
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }
  }]
}, { timestamps: true });

timeSlotSchema.index({ date: 1 });

module.exports = mongoose.model('TimeSlot', timeSlotSchema);