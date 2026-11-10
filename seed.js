// Optional: npm run seed  -> loads sample books and members
require('dotenv').config();
const mongoose = require('mongoose');
const Book = require('./models/Book');
const Member = require('./models/Member');

const books = [
  ['Things Fall Apart', 'Chinua Achebe', '9780385474542', 'Fiction', 1958, 4],
  ['Half of a Yellow Sun', 'Chimamanda Ngozi Adichie', '9781400095209', 'Fiction', 2006, 3],
  ['Clean Code', 'Robert C. Martin', '9780132350884', 'Technology', 2008, 2],
  ['The Pragmatic Programmer', 'Andrew Hunt, David Thomas', '9780135957059', 'Technology', 2019, 3],
  ['Eloquent JavaScript', 'Marijn Haverbeke', '9781593279509', 'Technology', 2018, 5],
  ['A Brief History of Time', 'Stephen Hawking', '9780553380163', 'Science', 1988, 2],
  ['Sapiens', 'Yuval Noah Harari', '9780062316097', 'History', 2015, 3],
  ['Educational Psychology', 'Anita Woolfolk', '9780134895093', 'Education', 2018, 2],
].map(([title, author, isbn, category, year, n]) => ({
  title, author, isbn, category, year, totalCopies: n, availableCopies: n,
}));

const members = [
  { name: 'Ama Mensah', email: 'ama@example.com', phone: '0240000001' },
  { name: 'Kwame Boateng', email: 'kwame@example.com', phone: '0240000002' },
  { name: 'Esi Owusu', email: 'esi@example.com', phone: '0240000003' },
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/library');
  await Book.deleteMany({});
  await Member.deleteMany({});
  await Book.insertMany(books);
  for (const m of members) await Member.create(m);
  console.log(`Seeded ${books.length} books and ${members.length} members`);
  await mongoose.disconnect();
})();
