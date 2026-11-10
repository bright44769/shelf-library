const router = require('express').Router();
const Member = require('../models/Member');
const Loan = require('../models/Loan');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query;
    const filter = {};
    if (q) {
      const rx = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { membershipId: rx }, { phone: rx }];
    }
    const members = await Member.find(filter).sort({ name: 1 }).lean();

    const counts = await Loan.aggregate([
      { $match: { status: 'issued' } },
      { $group: { _id: '$member', count: { $sum: 1 } } },
    ]);
    const map = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
    res.json(members.map((m) => ({ ...m, activeLoans: map[String(m._id)] || 0 })));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    res.json(member);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, email, phone, status } = req.body;
    const member = await Member.create({ name, email, phone, status });
    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    const { name, email, phone, status } = req.body;
    Object.assign(member, { name, email, phone, status });
    await member.save();
    res.json(member);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const active = await Loan.countDocuments({ member: req.params.id, status: 'issued' });
    if (active > 0) return res.status(400).json({ message: 'This member still has books on loan.' });
    const member = await Member.findByIdAndDelete(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    res.json({ message: 'Member deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
