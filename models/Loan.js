const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema(
  {
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    returnDate: { type: Date },
    fine: { type: Number, default: 0 },
    status: { type: String, enum: ['issued', 'returned'], default: 'issued' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Loan', loanSchema);
