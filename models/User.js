const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Not required for accounts created through Google sign in
    password: { type: String, minlength: 6, required: function () { return !this.googleId; } },
    googleId: { type: String, index: true, sparse: true },
    role: { type: String, enum: ['admin', 'librarian', 'student'], default: 'student' },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matches = function (plain) {
  return this.password ? bcrypt.compare(plain, this.password) : false;
};

module.exports = mongoose.model('User', userSchema);
