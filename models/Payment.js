const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  razorpayId: { type: String }
}, { timestamps: true });

paymentSchema.index({ appointmentId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);