const jwt = require('jsonwebtoken');

const adminAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Admin token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'gleuhr-jwt-secret');
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }
};

module.exports = adminAuth;
