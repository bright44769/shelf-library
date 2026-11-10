const router = require('express').Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Member = require('../models/Member');
const auth = require('../middleware/auth');

const secret = () => process.env.JWT_SECRET || 'dev-secret';
const sign = (u) => jwt.sign({ id: u._id, name: u.name, role: u.role }, secret(), { expiresIn: '8h' });
const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role });
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const googleReady = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const baseUrl = (req) => process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
const callbackUrl = (req) => process.env.GOOGLE_CALLBACK_URL || `${baseUrl(req)}/api/auth/google/callback`;
const readCookie = (req, name) => {
  const part = (req.headers.cookie || '').split(';').map((s) => s.trim()).find((s) => s.startsWith(name + '='));
  return part ? part.slice(name.length + 1) : null;
};

/* ---------- Email + password ---------- */

// Student sign up
router.post('/register', async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').toLowerCase().trim();
    const password = req.body.password || '';

    if (!name) return res.status(400).json({ message: 'Enter your full name' });
    if (!EMAIL_RX.test(email)) return res.status(400).json({ message: 'Enter a valid email address' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    if (await User.findOne({ email })) {
      return res.status(409).json({ message: 'An account with this email already exists. Sign in instead.' });
    }
    // A library member already exists for this email: only link it through Google (verified email)
    if (await Member.findOne({ email })) {
      return res.status(409).json({
        message: 'This email is already registered with the library. Continue with Google, or ask the librarian to link your account.',
      });
    }

    const member = await Member.create({ name, email });
    const user = await User.create({ name, email, password, role: 'student', member: member._id });
    res.status(201).json({ token: sign(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// Sign in (students, librarians and admins)
router.post('/login', async (req, res, next) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    const password = req.body.password || '';
    if (!email || !password) return res.status(400).json({ message: 'Enter your email and password' });

    const user = await User.findOne({ email });
    if (user && !user.password) {
      return res.status(400).json({ message: 'This account uses Google. Choose "Continue with Google".' });
    }
    if (!user || !(await user.matches(password))) {
      return res.status(401).json({ message: 'Incorrect email or password' });
    }
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: 'Account not found, please sign in again' });
    res.json(publicUser(user));
  } catch (err) {
    next(err);
  }
});

router.post('/password', auth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: 'Account not found' });
    if (user.password && !(await user.matches(currentPassword || ''))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
});

/* ---------- Google OAuth 2.0 ---------- */

router.get('/config', (req, res) => res.json({ google: googleReady() }));

router.get('/google', (req, res) => {
  if (!googleReady()) return res.redirect('/?error=' + encodeURIComponent('Google sign in is not set up yet'));
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 10 * 60 * 1000, path: '/api/auth' });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(req),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + params);
});

router.get('/google/callback', async (req, res) => {
  const fail = (m) => res.redirect('/?error=' + encodeURIComponent(m));
  try {
    const { code, state, error } = req.query;
    const saved = readCookie(req, 'oauth_state');
    res.clearCookie('oauth_state', { path: '/api/auth' });

    if (error) return fail('Google sign in was cancelled');
    if (!code || !state || !saved || state !== saved) return fail('Google sign in expired. Please try again.');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl(req),
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.access_token) {
      console.error('Google token error:', tokens);
      return fail('Google rejected the sign in. Check your client ID, secret and redirect URI.');
    }

    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + tokens.access_token },
    });
    const info = await infoRes.json();
    if (!info.email || !info.email_verified) return fail('Your Google email address is not verified');

    const email = info.email.toLowerCase();
    const name = info.name || email.split('@')[0];
    let user = await User.findOne({ $or: [{ googleId: info.sub }, { email }] });

    if (!user) {
      let member = await Member.findOne({ email });
      if (!member) member = await Member.create({ name, email });
      user = await User.create({ name, email, googleId: info.sub, role: 'student', member: member._id });
    } else if (!user.googleId) {
      user.googleId = info.sub;
      await user.save();
    }

    // Token goes in the URL fragment so it never reaches server logs
    res.redirect('/#token=' + encodeURIComponent(sign(user)));
  } catch (err) {
    console.error('Google sign in failed:', err);
    fail('Google sign in failed. Please try again.');
  }
});

module.exports = router;
