const mongoose = require('mongoose');

const otpSessionSchema = new mongoose.Schema(
  {
    mobile: { type: String, required: true, unique: true, index: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Number, required: true },
    attempts: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    lastSentAt: { type: Number, required: true }
  },
  { collection: 'otp_sessions' }
);

module.exports = mongoose.model('OtpSession', otpSessionSchema);
