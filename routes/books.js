const router = require('express').Router();
const { staff } = require('../middleware/auth');
const Book = require('../models/Book');
const Loan = require('../models/Loan');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// List / search
router.get('/', async (req, res, next) => {
  try {
    const { q, category, available } = req.query;
    const filter = {};
    if (q) {
      const rx = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$or = [{ title: rx }, { author: rx }, { isbn: rx }, { category: rx }];
    }
    if (category) filter.category = category;
    if (available === 'true') filter.availableCopies = { $gt: 0 };
    const books = await Book.find(filter).sort({ title: 1 });
    res.json(books);
  } catch (err) {
    next(err);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    res.json((await Book.distinct('category')).sort());
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.json(book);
  } catch (err) {
    next(err);
  }
});

router.post('/', staff, async (req, res, next) => {
  try {
    const { title, author, isbn, category, publisher, year, totalCopies } = req.body;
    const copies = Number(totalCopies) || 1;
    const book = await Book.create({
      title, author, isbn, category, publisher, year,
      totalCopies: copies,
      availableCopies: copies,
    });
    res.status(201).json(book);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', staff, async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });

    const { title, author, isbn, category, publisher, year, totalCopies } = req.body;
    const newTotal = totalCopies !== undefined ? Number(totalCopies) : book.totalCopies;
    const checkedOut = book.totalCopies - book.availableCopies;
    if (newTotal < checkedOut) {
      return res.status(400).json({ message: `${checkedOut} copies are currently on loan, so total copies can't go below ${checkedOut}` });
    }

    Object.assign(book, { title, author, isbn, category, publisher, year });
    book.totalCopies = newTotal;
    book.availableCopies = newTotal - checkedOut;
    await book.save();
    res.json(book);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', staff, async (req, res, next) => {
  try {
    const onLoan = await Loan.countDocuments({ book: req.params.id, status: 'issued' });
    if (onLoan > 0) return res.status(400).json({ message: 'This book has copies on loan. Return them before deleting it.' });
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.json({ message: 'Book deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
