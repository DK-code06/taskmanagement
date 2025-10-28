// middleware/auth.js (Corrected)

const jwt = require('jsonwebtoken');
require('dotenv').config(); // ✅ ADD this to load .env variables

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    // ✅ CHANGE this to use the secret from your .env file
    const decoded = jwt.verify(token, process.env.JWT_SECRET); 
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = auth;