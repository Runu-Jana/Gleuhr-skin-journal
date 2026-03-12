const jwt = require('jsonwebtoken');

const dieticianAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Dietician token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'dietician' && decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Dietician access required' });
    }
    req.dietician = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = dieticianAuth;
