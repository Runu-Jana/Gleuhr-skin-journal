const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { fetchTeamMembers } = require('../services/airtableService');

// POST /api/admin/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // ── 1. Check admin credentials ───────────────────────────────────────────
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const token = jwt.sign({ role: 'admin', email }, process.env.JWT_SECRET, { expiresIn: '8h' });
      return res.json({ token, role: 'admin', expiresIn: 28800 });
    }
  }

  // ── 2. Check team lead credentials ──────────────────────────────────────
  const teamLeadPassword = process.env.TEAM_LEAD_PASSWORD || process.env.DIETICIAN_PASSWORD;
  const teamLeadEmails   = (process.env.TEAM_LEAD_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

  if (teamLeadPassword && password === teamLeadPassword && teamLeadEmails.includes(email.toLowerCase())) {
    try {
      const members = await fetchTeamMembers();
      const member = members.find(m => m.email && m.email.toLowerCase() === email.toLowerCase());
      const name = member?.name || email;
      const token = jwt.sign({ role: 'team_lead', email, name }, process.env.JWT_SECRET, { expiresIn: '8h' });
      return res.json({ token, role: 'team_lead', name, expiresIn: 28800 });
    } catch {
      return res.status(500).json({ error: 'Failed to validate credentials' });
    }
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

// POST /api/admin/auth/verify
router.post('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Not an admin token' });
    }
    res.json({ valid: true, email: decoded.email });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

module.exports = router;
