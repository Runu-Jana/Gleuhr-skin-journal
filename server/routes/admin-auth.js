const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// POST /api/admin/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const validEmail = process.env.ADMIN_EMAIL || 'admin@gleuhr.com';
  const validPassword = process.env.ADMIN_PASSWORD || 'gleuhr-admin-2024';

  if (email !== validEmail || password !== validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { role: 'admin', email },
    process.env.JWT_SECRET || 'gleuhr-jwt-secret',
    { expiresIn: '8h' }
  );

  res.json({ token, expiresIn: 28800 });
});

// POST /api/admin/auth/verify
router.post('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'gleuhr-jwt-secret');
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Not an admin token' });
    }
    res.json({ valid: true, email: decoded.email });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

module.exports = router;
