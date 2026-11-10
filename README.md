# Shelf — Library Management System

Full stack app: **HTML/CSS/JavaScript** frontend, **Node.js + Express** REST API, **MongoDB** (Mongoose) database.

## Features
- Sign in with JWT authentication (passwords hashed with bcrypt)
- Books: add, edit, delete, search, track total and available copies
- Members: add, edit, suspend, delete, auto-generated membership IDs
- Loans: issue and return books, due dates, overdue tracking, automatic fines
- Dashboard with live library statistics
- Safe rules: no issuing the last copy twice, loan limit per member, no deleting books or members with active loans

## Run it
1. Install Node.js 18+ and MongoDB (local) or use a MongoDB Atlas connection string.
2. In this folder:
   ```bash
   npm install
   cp .env.example .env     # then edit MONGODB_URI and JWT_SECRET
   npm run seed             # optional: sample books and members
   npm start
   ```
3. Open http://localhost:3000 and sign in with `admin@library.com` / `admin123` (created automatically on first run — change it).

## Project structure
```
server.js            Express app, Mongo connection, error handling
models/              User, Book, Member, Loan (Mongoose schemas)
routes/              auth, books, members, loans, stats
middleware/auth.js   JWT check for protected routes
public/              index.html, css/style.css, js/app.js (the frontend)
seed.js              Sample data loader
```

## API (all except login need `Authorization: Bearer <token>`)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/auth/login | Sign in |
| GET/POST | /api/books | List (`?q=&available=true`) / add |
| PUT/DELETE | /api/books/:id | Edit / delete |
| GET/POST | /api/members | List (`?q=`) / add |
| PUT/DELETE | /api/members/:id | Edit / delete |
| GET | /api/loans | List (`?status=issued\|overdue\|returned`) |
| POST | /api/loans/issue | Issue `{ bookId, memberId, days }` |
| POST | /api/loans/:id/return | Return a book, calculates fine |
| GET | /api/stats | Dashboard numbers |

Settings in `.env`: `FINE_PER_DAY`, `LOAN_DAYS`, `MAX_LOANS_PER_MEMBER`.


## Pages and roles
| Page | Who | What |
|---|---|---|
| `/` (index.html) | Everyone | Sign in, create a student account, or continue with Google |
| `/student.html` | Students | Search the catalogue, see my loans, due dates and fines |
| `/admin.html` | Admin, librarian | Dashboard, books, members, loans. Admins also get **Users** (add staff, change roles, delete accounts) |

New sign-ups are always students. Staff accounts are added by an admin. You are sent to the right page automatically after you sign in.

## Google sign in (OAuth 2.0)
1. Go to https://console.cloud.google.com, create a project, and set up the **OAuth consent screen** (External; add yourself as a test user).
2. **APIs & Services -> Credentials -> Create credentials -> OAuth client ID -> Web application**.
3. Under **Authorized redirect URIs** add exactly: `http://localhost:4000/api/auth/google/callback` (use your own port, and your real domain when deployed).
4. Copy the client ID and secret into `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```
5. Restart `npm start`. Signing in with Google creates a student account and library membership automatically.
