const router = require('express').Router();
const Loan = require('../models/Loan');
const Book = require('../models/Book');
const Member = require('../models/Member');

const DAY = 24 * 60 * 60 * 1000;
const finePerDay = () => Number(process.env.FINE_PER_DAY) || 0.5;
const maxLoans = () => Number(process.env.MAX_LOANS_PER_MEMBER) || 5;
const defaultDays = () => Number(process.env.LOAN_DAYS) || 14;

const overdueDays = (loan, now = new Date()) => {
  const end = loan.returnDate || now;
  return Math.max(0, Math.ceil((end - loan.dueDate) / DAY));
};

// List loans (?status=issued|overdue|returned)
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status === 'issued') filter.status = 'issued';
    if (status === 'returned') filter.status = 'returned';
    if (status === 'overdue') {
      filter.status = 'issued';
      filter.dueDate = { $lt: new Date() };
    }
    const loans = await Loan.find(filter)
      .populate('book', 'title author isbn')
      .populate('member', 'name membershipId email')
      .sort({ createdAt: -1 })
      .lean();

    const now = new Date();
    res.json(
      loans.map((l) => {
        const days = overdueDays(l, now);
        return {
          ...l,
          isOverdue: l.status === 'issued' && days > 0,
          overdueDays: days,
          fine: l.status === 'issued' ? +(days * finePerDay()).toFixed(2) : l.fine,
        };
      })
    );
  } catch (err) {
    next(err);
  }
});

// Issue a book
router.post('/issue', async (req, res, next) => {
  try {
    const { bookId, memberId } = req.body;
    const days = Number(req.body.days) || defaultDays();

    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    if (member.status !== 'active') return res.status(400).json({ message: 'This member is suspended' });

    const active = await Loan.find({ member: memberId, status: 'issued' });
    if (active.length >= maxLoans()) {
      return res.status(400).json({ message: `Members can borrow up to ${maxLoans()} books at a time` });
    }
    if (active.some((l) => String(l.book) === String(bookId))) {
      return res.status(400).json({ message: 'This member already has a copy of this book' });
    }

    // Atomic decrement so two librarians can't issue the last copy twice
    const book = await Book.findOneAndUpdate(
      { _id: bookId, availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1 } },
      { new: true }
    );
    if (!book) return res.status(400).json({ message: 'No copies of this book are available' });

    const loan = await Loan.create({
      book: bookId,
      member: memberId,
      dueDate: new Date(Date.now() + days * DAY),
    });
    res.status(201).json(loan);
  } catch (err) {
    next(err);
  }
});

// Return a book
router.post('/:id/return', async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    if (loan.status === 'returned') return res.status(400).json({ message: 'This book was already returned' });

    loan.returnDate = new Date();
    loan.status = 'returned';
    loan.fine = +(overdueDays(loan) * finePerDay()).toFixed(2);
    await loan.save();
    await Book.findByIdAndUpdate(loan.book, { $inc: { availableCopies: 1 } });

    res.json(loan);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
