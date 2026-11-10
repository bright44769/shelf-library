// Student self-service: my profile and my loans
const router = require('express').Router();
const User = require('../models/User');
const Loan = require('../models/Loan');

const DAY = 24 * 60 * 60 * 1000;
const finePerDay = () => Number(process.env.FINE_PER_DAY) || 0.5;
const overdueDays = (loan, now) => Math.max(0, Math.ceil(((loan.returnDate || now) - loan.dueDate) / DAY));

async function myLoans(userId) {
  const user = await User.findById(userId).populate('member');
  if (!user) return { user: null, loans: [] };
  const raw = user.member
    ? await Loan.find({ member: user.member._id }).populate('book', 'title author category').sort({ createdAt: -1 }).lean()
    : [];
  const now = new Date();
  const loans = raw.map((l) => {
    const days = overdueDays(l, now);
    return {
      ...l,
      isOverdue: l.status === 'issued' && days > 0,
      overdueDays: days,
      fine: l.status === 'issued' ? +(days * finePerDay()).toFixed(2) : l.fine,
    };
  });
  return { user, loans };
}

router.get('/', async (req, res, next) => {
  try {
    const { user, loans } = await myLoans(req.user.id);
    if (!user) return res.status(401).json({ message: 'Account not found, please sign in again' });
    res.json({
      user: { name: user.name, email: user.email, role: user.role },
      member: user.member ? { membershipId: user.member.membershipId, status: user.member.status } : null,
      summary: {
        onLoan: loans.filter((l) => l.status === 'issued').length,
        overdue: loans.filter((l) => l.isOverdue).length,
        fineSoFar: +loans.filter((l) => l.status === 'issued').reduce((s, l) => s + l.fine, 0).toFixed(2),
        totalBorrowed: loans.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/loans', async (req, res, next) => {
  try {
    res.json((await myLoans(req.user.id)).loans);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
