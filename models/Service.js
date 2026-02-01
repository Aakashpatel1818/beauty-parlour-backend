const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  duration: { type: Number, required: true }, // minutes
  category: { type: String, enum: ['hair', 'skin', 'bridal'], required: true },
  image: { type: String }
}, { timestamps: true });

serviceSchema.index({ category: 1 });

module.exports = mongoose.model('Service', serviceSchema);