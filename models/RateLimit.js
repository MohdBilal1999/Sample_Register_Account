const mongoose = require('mongoose');

const rateLimitSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, index: true },
    createdAt: { type: Date, default: Date.now, expires: 900 }
  },
  { collection: 'rate_limits' }
);

module.exports = mongoose.model('RateLimit', rateLimitSchema);
