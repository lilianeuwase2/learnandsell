const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function publicUser(u) {
  return {
    id: u.id, name: u.name, contact: u.contact, role: u.role,
    language: u.language, avatar: u.avatar, active: u.active,
  };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, contact, password, role = 'learner', language = 'English' } = req.body;
  if (!name || !contact || !password) {
    return res.status(400).json({ error: 'name, contact and password are required' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  if (!['learner', 'buyer', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'role must be learner, buyer or admin' });
  }

  const existing = await db.query('SELECT id FROM users WHERE contact = $1', [contact]);
  if (existing.rows.length) {
    return res.status(409).json({ error: 'An account with this phone/email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await db.query(
    `INSERT INTO users (name, contact, password_hash, role, language)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, contact, passwordHash, role, language]
  );
  const user = result.rows[0];

  await db.query(
    `INSERT INTO notifications (user_id, text) VALUES ($1,$2)`,
    [user.id, `Welcome ${name.split(' ')[0]}! Your ${role} account is ready.`]
  );

  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { contact, password } = req.body;
  if (!contact || !password) {
    return res.status(400).json({ error: 'contact and password are required' });
  }

  const result = await db.query('SELECT * FROM users WHERE contact = $1', [contact]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid contact or password' });
  if (!user.active) return res.status(403).json({ error: 'This account has been suspended' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid contact or password' });

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(result.rows[0]) });
});

// PATCH /api/auth/me - update profile (name, contact, language, avatar)
router.patch('/me', requireAuth, async (req, res) => {
  const { name, contact, language, avatar } = req.body;
  const result = await db.query(
    `UPDATE users SET
       name = COALESCE($1, name),
       contact = COALESCE($2, contact),
       language = COALESCE($3, language),
       avatar = COALESCE($4, avatar)
     WHERE id = $5 RETURNING *`,
    [name, contact, language, avatar, req.user.id]
  );
  await db.query(`INSERT INTO notifications (user_id, text) VALUES ($1,$2)`,
    [req.user.id, 'Your profile was updated successfully.']);
  res.json({ user: publicUser(result.rows[0]) });
});

// POST /api/auth/forgot-password
// Simulated: no real email/SMS is sent (no mail provider wired up yet).
// Real behaviour to add later: generate a signed, expiring reset token,
// email/SMS it, and add a POST /auth/reset-password?token=... route.
router.post('/forgot-password', async (req, res) => {
  const { contact } = req.body;
  if (!contact) return res.status(400).json({ error: 'contact is required' });

  const user = (await db.query('SELECT id FROM users WHERE contact=$1', [contact])).rows[0];
  if (user) {
    await db.query('INSERT INTO notifications (user_id, text) VALUES ($1,$2)',
      [user.id, `Password reset link sent to ${contact} (simulated).`]);
  }
  // Always respond success, whether or not the contact exists, so the
  // endpoint can't be used to check which phone/emails are registered.
  res.json({ ok: true, message: `If an account exists for ${contact}, a reset link has been sent (simulated).` });
});

module.exports = router;
