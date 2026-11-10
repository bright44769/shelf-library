const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    membershipId: { type: String, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  },
  { timestamps: true }
);

memberSchema.pre('validate', function (next) {
  if (!this.membershipId) {
    this.membershipId = 'MEM-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 90 + 10);
  }
  next();
});

module.exports = mongoose.model('Member', memberSchema);
