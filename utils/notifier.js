const cron = require('node-cron');
const Booking = require('../models/Booking');
const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

cron.schedule('0 9 * * *', async () => {
  const today = new Date();
  const bookings = await Booking.find({ date: today, status: 'confirmed' });
  for (const b of bookings) {
    await twilio.messages.create({
      body: `Reminder: Your booking at ${b.time} today!`,
      from: 'whatsapp:+14155238886',
      to: `whatsapp:+91${b.user.phone}` // Populate user
    });
  }
});

module.exports = cron;