const TimeSlot = require('../models/TimeSlot');

exports.getTimeSlots = async (req, res) => {
  try {
    const { date } = req.query;
    let slot = await TimeSlot.findOne({ date: new Date(date) });
    if (!slot) {
      // Generate default slots (e.g., 9AM-6PM hourly)
      const slots = Array.from({ length: 10 }, (_, i) => ({
        time: `${9 + i}:00 AM`,
        available: true
      }));
      slot = new TimeSlot({ date: new Date(date), slots });
      await slot.save();
    }
    res.json(slot.slots);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.blockSlot = async (req, res) => {
  const { date, time } = req.body;
  try {
    await TimeSlot.updateOne(
      { date, 'slots.time': time },
      { $set: { 'slots.$.available': false } }
    );
    res.json({ message: 'Slot blocked' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};