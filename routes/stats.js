const router = require('express').Router();
const Book = require('../models/Book');
const Member = require('../models/Member');
const Loan = require('../models/Loan');

router.get('/', async (req, res, next) => {
  try {
    const [titles, copies, members, issued, overdue, fines] = await Promise.all([
      Book.countDocuments(),
      Book.aggregate([{ $group: { _id: null, total: { $sum: '$totalCopies' }, available: { $sum: '$availableCopies' } } }]),
      Member.countDocuments(),
      Loan.countDocuments({ status: 'issued' }),
      Loan.countDocuments({ status: 'issued', dueDate: { $lt: new Date() } }),
      Loan.aggregate([{ $match: { status: 'returned' } }, { $group: { _id: null, total: { $sum: '$fine' } } }]),
    ]);
    res.json({
      titles,
      totalCopies: copies[0]?.total || 0,
      availableCopies: copies[0]?.available || 0,
      members,
      activeLoans: issued,
      overdueLoans: overdue,
      finesCollected: +(fines[0]?.total || 0).toFixed(2),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
