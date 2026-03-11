const { createProxyMiddleware } = require('http-proxy-middleware');

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: BACKEND,
      changeOrigin: true,
      onError: (err, req, res) => {
        console.error(`[proxy] ${req.method} ${req.path} →`, err.message);
        res.status(503).json({
          error: 'Backend unavailable',
          details: err.message,
          target: BACKEND,
        });
      },
    })
  );
};
