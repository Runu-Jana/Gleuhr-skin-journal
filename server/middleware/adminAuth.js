// Simple admin authentication middleware
// In production, you should use proper authentication like JWT, sessions, etc.

const adminAuth = (req, res, next) => {
  // For development, we'll use a simple API key
  // In production, implement proper authentication
  const apiKey = req.headers['x-admin-api-key'];
  
  // Simple API key check (change this in production!)
  const validApiKey = process.env.ADMIN_API_KEY || 'gleuhr-admin-2024';
  
  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Valid admin API key required'
    });
  }
  
  next();
};

module.exports = adminAuth;
