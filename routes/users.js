// Admin only: manage accounts
const router = require('express').Router();
const User = require('../models/User');
const Member = require('../models/Member');

const ROLES = ['admin', 'librarian', 'student'];

router.get('/', async (req, res, next) => {
  try {
    const users = await User.find().sort({ role: 1, name: 1 }).lean();
    res.json(
      users.map((u) => ({
        _id: u._id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt,
        signIn: [u.password ? 'Password' : null, u.googleId ? 'Google' : null].filter(Boolean).join(' + '),
      }))
    );
  } catch (err) {
    next(err);
  }
});

// Add a staff account
router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!['admin', 'librarian'].includes(role)) return res.status(400).json({ message: 'Choose admin or librarian' });
    const user = await User.create({ name, email, password, role });
    res.status(201).json({ _id: user._id });
  } catch (err) {
    next(err);
  }
});

// Change a role
router.put('/:id', async (req, res, next) => {
  try {
    if (req.params.id === String(req.user.id)) return res.status(400).json({ message: "You can't change your own role" });
    const { role } = req.body;
    if (!ROLES.includes(role)) return res.status(400).json({ message: 'Invalid role' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.role = role;
    if (role === 'student' && !user.member) {
      const member = (await Member.findOne({ email: user.email })) || (await Member.create({ name: user.name, email: user.email }));
      user.member = member._id;
    }
    await user.save();
    res.json({ message: 'Role updated' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (req.params.id === String(req.user.id)) return res.status(400).json({ message: "You can't delete your own account" });
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
