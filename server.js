require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const auth = require('./middleware/auth');
const { staff, adminOnly } = auth;
const User = require('./models/User');

const app = express();
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/books', auth, require('./routes/books')); // read: any signed-in user, write: staff
app.use('/api/members', auth, staff, require('./routes/members'));
app.use('/api/loans', auth, staff, require('./routes/loans'));
app.use('/api/stats', auth, staff, require('./routes/stats'));
app.use('/api/me', auth, require('./routes/me'));
app.use('/api/users', auth, adminOnly, require('./routes/users'));
app.use('/api', (req, res) => res.status(404).json({ message: 'Endpoint not found' }));

// Frontend
app.use(express.static(path.join(__dirname, 'public')));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join(', ');
    return res.status(400).json({ message });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'value';
    return res.status(409).json({ message: `A record with this ${field} already exists` });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid ID' });
  }
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/library';

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected');
    // Create a default admin on first run
    if ((await User.countDocuments()) === 0) {
      await User.create({
        name: 'Librarian',
        email: 'admin@library.com',
        password: 'admin123',
        role: 'admin',
      });
      console.log('Default admin created -> admin@library.com / admin123 (change this!)');
    }
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
