// backend/src/routes/auth.js

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { verifyToken } = require('../middleware/auth');
const vexAccount = require('../../services/vexaccount');

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const account = await vexAccount.createAccount(req.body);
    res.status(201).json(account);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    // TODO: validate credentials properly (e.g., check password)
    const user = await vexAccount.getAccount(req.body.id);
    if (!user) return res.status(401).json({ error: 'Authentication failed' });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// GET /auth/me (protected)
router.get('/me', verifyToken, (req, res) => {
  res.json(req.user);
});

module.exports = router;
