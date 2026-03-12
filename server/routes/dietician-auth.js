const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { fetchTeamMembers } = require('../services/airtableService');

// POST /api/dietician/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  if (!process.env.DIETICIAN_PASSWORD || !process.env.JWT_SECRET) {
    console.error('Missing required env vars: DIETICIAN_PASSWORD, JWT_SECRET');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Validate password
  if (password !== process.env.DIETICIAN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Validate email against Team table (Dieticians)
  let teamMembers = [];
  try {
    teamMembers = await fetchTeamMembers();
  } catch (err) {
    console.error('[dietician-auth] Failed to fetch team members:', err);
    return res.status(500).json({ error: 'Failed to validate credentials' });
  }

  const member = teamMembers.find(m => m.email && m.email.toLowerCase() === email.toLowerCase());
  if (!member) {
    return res.status(401).json({ error: 'Email not found in dietician team' });
  }

  const token = jwt.sign(
    { role: 'dietician', email: member.email, name: member.name },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, name: member.name, email: member.email, expiresIn: 28800 });
});

module.exports = router;
