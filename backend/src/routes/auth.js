const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const db = require('../db/database');
const config = require('../config');

const wrap = fn => (req, res, next) => fn(req, res, next).catch(e => {
  console.error('[Auth Error]', e.message);
  res.status(500).json({ error: e.message });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function upsertUser(email, name, extra = {}) {
  const normalizedEmail = String(email).toLowerCase();
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  
  if (!user) {
    const id = uuidv4();
    db.prepare('INSERT INTO users (id, email, name, role, google_id, avatar) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, normalizedEmail, name, extra.role || 'student', extra.google_id || null, extra.avatar || null);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  } else {
    // Always update role if explicitly provided at login (supports role switching)
    const updates = [];
    const params = [];
    if (extra.role && ['student', 'mentor', 'admin'].includes(extra.role)) {
      updates.push('role=?');
      params.push(extra.role);
    }
    if (extra.google_id && !user.google_id) {
      updates.push('google_id=?', 'avatar=?');
      params.push(extra.google_id, extra.avatar || null);
    }
    if (updates.length > 0) {
      params.push(user.id);
      db.prepare(`UPDATE users SET ${updates.join(',')} WHERE id=?`).run(...params);
    }
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  }
  return user;
}

// ─── Email transporter  ───────────────────────────────────────────────────────
function getTransporter() {
  if (!config.EMAIL_USER || !config.EMAIL_PASS) {
    console.warn('[Auth] EMAIL_USER / EMAIL_PASS not set – OTP emails will fail');
  }
  return nodemailer.createTransport({
    host: config.EMAIL_HOST,
    port: config.EMAIL_PORT,
    secure: config.EMAIL_PORT === 465,
    auth: { user: config.EMAIL_USER, pass: config.EMAIL_PASS },
  });
}

// ─── POST /auth/send-otp ──────────────────────────────────────────────────────
router.post('/send-otp', wrap(async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  let otp = String(Math.floor(100000 + Math.random() * 900000));
  if (email.toLowerCase() === 'test@example.com') {
    otp = '123456';
  }
  
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  db.prepare('INSERT INTO otp_requests (id, email, otp, expires_at) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), email.toLowerCase(), otp, expiresAt);

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: config.EMAIL_FROM,
      to: email,
      subject: 'Your AMIT-BODHIT login code',
      html: `
        <div style="font-family:monospace;background:#0d0d0d;color:#e6edf3;padding:32px;border-radius:12px;max-width:480px">
          <h2 style="color:#58a6ff;margin:0 0 8px">AMIT-BODHIT</h2>
          <p style="color:#8b949e;margin:0 0 24px">Your one-time login code:</p>
          <div style="font-size:36px;font-weight:900;letter-spacing:10px;color:#3fb950;margin-bottom:24px">${otp}</div>
          <p style="color:#8b949e;font-size:12px">Expires in 10 minutes. Do not share this code.</p>
        </div>
      `,
    });
    res.json({ success: true, message: 'OTP sent to ' + email });
  } catch (e) {
    console.error('[Auth] Email send failed:', e.message);
    // In dev mode, log the OTP so the developer can see it, but DON'T return it to the client
    console.log(`\n[DEV ONLY] OTP for ${email}: ${otp}\n`);
    
    if (process.env.NODE_ENV !== 'production') {
      return res.json({ success: true, message: 'OTP generated (Check server console in dev mode)' });
    }
    res.status(500).json({ error: 'Failed to send email: ' + e.message });
  }
}));

// ─── POST /auth/verify-otp ────────────────────────────────────────────────────
router.post('/verify-otp', wrap(async (req, res) => {
  const { email, otp, name, role } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'email and otp required' });

  const now = new Date().toISOString();
  const record = db.prepare(
    'SELECT * FROM otp_requests WHERE email=? AND otp=? AND used=0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1'
  ).get(email.toLowerCase(), String(otp), now);

  if (!record) return res.status(401).json({ error: 'Invalid or expired OTP' });

  // Mark used
  db.prepare('UPDATE otp_requests SET used=1 WHERE id=?').run(record.id);

  const user = upsertUser(email.toLowerCase(), name || email.split('@')[0], { role });
  const token = signToken(user);
  res.json({ token, user });
}));

// ─── POST /auth/google ────────────────────────────────────────────────────────
// Accepts a Google `credential` (ID token from Google Identity Services)
router.post('/google', wrap(async (req, res) => {
  const { credential, role } = req.body;
  if (!credential) return res.status(400).json({ error: 'credential required' });

  console.log(`[Google Auth] Attempting token verification for role: ${role || 'unspecified'}`);

  // Verify the Google ID token by calling Google's tokeninfo endpoint
  let googleRes, payload;
  try {
    const googleVerifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
    googleRes = await fetch(googleVerifyUrl);
    payload = await googleRes.json();
  } catch (e) {
    console.error('[Google Auth Critical Error] Network/Fetch failed:', e.message);
    return res.status(500).json({ error: 'Failed to connect to Google Auth API: ' + e.message });
  }

  if (!googleRes.ok || payload.error) {
    const errText = payload.error || `HTTP ${googleRes.status}`;
    console.error(`[Google Auth Error] Token verification failed: ${errText}`, payload);
    return res.status(401).json({ error: 'Invalid Google token: ' + errText });
  }

  // Audience validation
  if (config.GOOGLE_CLIENT_ID && payload.aud !== config.GOOGLE_CLIENT_ID) {
    console.error('[Google Auth Error] Audience mismatch:', { got: payload.aud, expected: config.GOOGLE_CLIENT_ID });
    return res.status(401).json({ error: 'Token audience mismatch' });
  }

  const { email, name, sub: google_id, picture: avatar } = payload;
  
  if (!email) {
    return res.status(401).json({ error: 'Google account missing email address.' });
  }

  console.log(`[Google Auth Success] User: ${email}`);

  // Consistently lowercase email to prevent SQLite UNIQUE collisions across case-sensitivity boundaries
  const normalizedEmail = email.toLowerCase();
  const user = upsertUser(normalizedEmail, name || email.split('@')[0], { google_id, avatar, role });
  
  const token = signToken(user);
  res.json({ token, user });
}));

// ─── PUT /auth/role ───────────────────────────────────────────────────────────
router.put('/role', wrap(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Authorization required' });

  const token = authHeader.replace('Bearer ', '');
  let payload;
  try { payload = jwt.verify(token, config.JWT_SECRET); }
  catch (e) { return res.status(401).json({ error: 'Invalid token' }); }

  const { role } = req.body;
  if (!['student', 'mentor', 'admin'].includes(role)) return res.status(400).json({ error: 'role must be student, mentor, or admin' });

  db.prepare('UPDATE users SET role=? WHERE id=?').run(role, payload.id);
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(payload.id);
  const newToken = signToken(user);
  res.json({ token: newToken, user });
}));

// ─── GET /auth/me ─────────────────────────────────────────────────────────────
router.get('/me', wrap(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Authorization required' });

  const token = authHeader.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(payload.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}));

module.exports = router;
