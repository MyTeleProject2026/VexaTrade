// backend/src/middleware/auth.js

const jwt = require('jsonwebtoken');

module.exports = {
  verifyToken: (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload;
      next();
    } catch (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
  }
};
